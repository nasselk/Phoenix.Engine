import { Vector, type VectorStructure } from "../../../../../shared/libs/math/vector";

import type { Constructor } from "../../../../../shared/utils/types";

import { removeFromArray } from "../../../../../shared/utils/utils";

import { clamp } from "../../../../../shared/libs/math/utils";

type QueryCallback<T, Types, P extends any[]> = (objects: Types extends undefined ? T[] : { [K in keyof Types]: Types[K] extends Constructor<infer R> ? R[] : never }, queryID: number, param1: P[0], param2: P[1]) => boolean | void;
type PairsQueryCallback<T> = (entity1: T, entity2: T) => void;
type QueryCallbackValue<T extends HashGrid2D<any, any>> = Parameters<Parameters<T["query"]>[1]>[0];
type PairQueryCallbackValue<T extends HashGrid2D<any, any>> = Parameters<T["pairsQuery"]>[0];

interface Entity {
	id: number;
	readonly position: VectorStructure;
	readonly size: VectorStructure;
	readonly type: string;
	spawned: boolean;
	cellsKeys: Set<number>[];
	queryID: number;
	/**
	 * The cell rectangle this object occupies in the grid named by `cellBoundsGrid`,
	 * written by `insert` and `update`.
	 *
	 * `cellsKeys` says the same thing as a Set, and walking one is what `activitySince`
	 * does. For the check a sleeping entity runs on every one of its ticks that is too
	 * much — a Set walk is a hash walk — so the rectangle is kept as four plain fields
	 * and read directly. See `touchedSince`.
	 *
	 * ONE grid's rectangle, not one per grid, because an entity is only ever in one: the
	 * static grid or a per-tick grid, never both (`DynamicEntity.inStaticGrid` decides).
	 * `cellBoundsGrid` is what makes that an assumption the code checks rather than one
	 * it relies on — a reader for the wrong grid gets a conservative answer.
	 */
	cellMinX: number;
	cellMinY: number;
	cellMaxX: number;
	cellMaxY: number;
	cellBoundsGrid: number;
}

class HashGrid2D<T extends Entity, Types extends Record<string, Constructor<T>> | undefined = undefined> {
	public static gridCount: number = 0;

	public readonly id: number;
	private cellWidth: number;
	private cellHeight: number;
	private cells: (TypedCell<T, NonNullable<Types>> | UntypedCell<T> | null)[];
	/**
	 * Per cell, the `activity` counter's value when something was last placed in or
	 * moved within it. Lets an entity ask whether anything happened in its own cells
	 * since it last looked — see `activitySince` — which is what a stationary entity
	 * that reacts to arrivals (a food that splits when water is pushed into it) needs
	 * instead of rescanning its neighbourhood on every one of its ticks.
	 *
	 * Float64, not Uint32, because the counter it stores is a monotonic JS number and
	 * the comparison is against the value an entity kept from before. A Uint32 store
	 * wraps at 4.3 billion while the kept value does not, so from that moment every
	 * comparison reads "nothing happened" — permanently, on a long-lived lobby. Doubles
	 * hold every integer up to 2^53 exactly, which at any plausible rate of grid writes
	 * is longer than the process can live. It costs 8 bytes a cell (~26KB for the static
	 * grid) and reads no slower; a uint32 store has to narrow on every write anyway.
	 */
	private cellActivity: Float64Array;
	/**
	 * Per cell, the counter's value when anything last happened there that could REACH
	 * what lies in it: everything `cellActivity` records, plus a pass by something that
	 * is not in this grid at all but can act on what is — an animal, which lives in the
	 * dynamic grid and stamps the static one as it moves (see `stamp`).
	 *
	 * This is the first stage of a sleeping entity's wake test. The exact test reads a
	 * velocity, two positions, a steering direction, a size and a tumble flag across five
	 * objects, ~0.5us of cache misses, and on a lobby it ran for ~4,700 settled foods on
	 * every food tick — 2.4ms of it, which was the largest thing left in the update phase.
	 * Nothing can disturb a food without something first being placed in, moved within,
	 * or passing over one of its cells, so a quiet rectangle here is proof the exact test
	 * would find nothing, at a tenth of the cost.
	 *
	 * Kept apart from `cellActivity` because the two answer different questions: a split
	 * food rescans its neighbours on an ARRIVAL (something to split against), while a
	 * sleeper wakes on anything that might have pushed it. Sharing one counter would put
	 * every mushroom near a moving animal back to rescanning at its full tick rate.
	 */
	private cellTouch: Float64Array;
	private activityVersion: number;

	private readonly removableObjects: boolean;
	private readonly boundsBuffer: Uint32Array;
	private maxKeyX: number;
	private maxKeyY: number;
	private maxKey: number;
	private readonly typed: boolean;
	private readonly types?: Types;
	private readonly typesKeys?: (keyof Types)[];
	private cellKeys: Set<number>;
	private queryID: number;
	public entityCount: number;
	public totalEntitiesInCells: number;
	private readonly query2OutputCache: any;
	private readonly bounds: {
		min: Vector;
		max: Vector;
	};

	public constructor(cellWidth: number, cellHeight: number = cellWidth, bounds: { min: VectorStructure; max: VectorStructure }, removableObjects: boolean = true, types?: Types) {
		this.bounds = {
			min: new Vector(bounds.min.x, bounds.min.y),
			max: new Vector(bounds.max.x, bounds.max.y),
		};
		this.id = HashGrid2D.gridCount++;
		this.cellWidth = Math.max(cellWidth, 1);
		this.cellHeight = Math.max(cellHeight, 1);
		this.removableObjects = removableObjects;
		this.maxKeyX = Math.ceil((this.bounds.max.x - this.bounds.min.x) / this.cellWidth);
		this.maxKeyY = Math.ceil((this.bounds.max.y - this.bounds.min.y) / this.cellHeight);
		this.maxKey = this.getCellID(this.maxKeyX, this.maxKeyY);
		this.cells = new Array(this.maxKey + 1).fill(null);
		this.cellActivity = new Float64Array(this.maxKey + 1);
		this.cellTouch = new Float64Array(this.maxKey + 1);
		this.boundsBuffer = new Uint32Array(4);
		this.activityVersion = 0;
		this.typed = Boolean(types);
		this.cellKeys = new Set();
		this.types = types;
		this.totalEntitiesInCells = 0;
		this.entityCount = 0;
		this.queryID = 0;

		if (this.typed) {
			this.query2OutputCache = Object.fromEntries(Object.keys(this.types!).map((type) => [type, []]));

			this.typesKeys = Object.keys(this.types!) as (keyof Types)[];
		} else {
			this.query2OutputCache = [];
		}
	}

	public resize(bounds: { min: VectorStructure; max: VectorStructure }, cellWidth = this.cellWidth, cellHeight = this.cellHeight, restore: boolean = true): this {
		const cells = this.cells;
		const entities = new Set<T>();

		this.bounds.min.set(bounds.min);
		this.bounds.max.set(bounds.max);
		this.cellWidth = Math.max(cellWidth, 1);
		this.cellHeight = Math.max(cellHeight, 1);
		this.maxKeyX = Math.ceil((this.bounds.max.x - this.bounds.min.x) / this.cellWidth);
		this.maxKeyY = Math.ceil((this.bounds.max.y - this.bounds.min.y) / this.cellHeight);
		this.maxKey = this.getCellID(this.maxKeyX, this.maxKeyY);
		this.cells = new Array(this.maxKey + 1).fill(null);
		this.cellActivity = new Float64Array(this.maxKey + 1);
		this.cellTouch = new Float64Array(this.maxKey + 1);
		this.totalEntitiesInCells = 0;
		this.entityCount = 0;

		if (restore || this.removableObjects) {
			for (let i = 0; i < cells.length; i++) {
				const cell = cells[i];

				if (cell) {
					if (cell.typed) {
						for (const type in cell.objects) {
							for (let j = 0; j < cell.objects[type].length; j++) {
								const object = cell.objects[type][j];

								object.cellsKeys[this.id]?.clear();

								if (restore) {
									entities.add(object);
								}
							}
						}
					} else {
						for (let j = 0; j < cell.objects.length; j++) {
							const object = cell.objects[j];

							object.cellsKeys[this.id]?.clear();

							if (restore) {
								entities.add(object);
							}
						}
					}
				}
			}
		}

		if (restore) {
			for (const entity of entities) {
				this.insert(entity, entity.size.x, entity.size.y, entity.type);
			}
		}

		return this;
	}

	public initCells(): this {
		for (let i = 0; i <= this.maxKey; i++) {
			void this.createCell(i);
		}

		return this;
	}

	private getCellID(x: number, y: number): number {
		return y * (this.maxKeyX + 1) + x; // Row-major order
	}

	private createCell(key: number): TypedCell<T, NonNullable<Types>> | UntypedCell<T> {
		let cell: any;

		if (this.typed) {
			cell = new TypedCell<T, NonNullable<Types>>(key, this.types!);
		} else {
			cell = new UntypedCell<T>(key);
		}

		this.cells[key] = cell;

		return cell;
	}

	private getCell(key: number): TypedCell<T, NonNullable<Types>> | UntypedCell<T> {
		const cell = this.cells[key] || this.createCell(key);

		return cell;
	}

	private getBounds(object: T, rangeX: number = object.size.x, rangeY: number = object.size.y): Uint32Array {
		const localX = object.position.x - this.bounds.min.x;
		const localY = object.position.y - this.bounds.min.y;

		// Clamp and truncate
		this.boundsBuffer[0] = clamp((localX - rangeX / 2) / this.cellWidth, 0, this.maxKeyX) | 0;
		this.boundsBuffer[1] = clamp((localY - rangeY / 2) / this.cellHeight, 0, this.maxKeyY) | 0;
		this.boundsBuffer[2] = clamp((localX + rangeX / 2) / this.cellWidth, 0, this.maxKeyX) | 0;
		this.boundsBuffer[3] = clamp((localY + rangeY / 2) / this.cellHeight, 0, this.maxKeyY) | 0;

		return this.boundsBuffer;
	}

	public insert(object: T, rangeX?: number, rangeY?: number, type: string = object.type): this {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const maxX = bounds[2]!;
		const maxY = bounds[3]!;

		let cellsKeys: Set<number> | undefined;

		if (this.removableObjects) {
			cellsKeys = object.cellsKeys[this.id];

			//	if (!cellsKeys) {
			cellsKeys = new Set();

			object.cellsKeys[this.id] = cellsKeys;
			//	} else if (cellsKeys.size > 0) {
			//		throw new Error("Object is already in the grid"); DISABLED BECAUSE OF TREES
			//	}
		}

		this.entityCount++;

		// `cellMinX`/`cellMinY` are also what pairsQuery dedupes on: the per-tick grids are
		// the only ones that run it, and an entity is inserted into exactly one of them per
		// tick. See `cellMinX` on the element type.
		this.setBounds(object, minX, minY, maxX, maxY);

		const version = ++this.activityVersion;

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				const key: number = this.getCellID(x, y);

				this.cellActivity[key] = version;
				this.cellTouch[key] = version;

				const cell = this.getCell(key);

				this.totalEntitiesInCells++;

				if (cell.typed) {
					cell.insert(object, type, cellsKeys);
				} else {
					cell.insert(object, cellsKeys);
				}
			}
		}

		return this;
	}

	/**
	 * Take `object` out of the cells its recorded rectangle covers — removal for a grid
	 * that keeps no `cellsKeys` (see `place`, and `cellMinX` on the element type).
	 *
	 * `remove` walks the Set that only the removable grids maintain. The FOV thread's grid
	 * is edited in place but has no Sets, so it removes by rectangle instead: the same
	 * cells `insert` pushed into, since the rectangle is written by the same call.
	 */
	public removeByBounds(object: T, type: string = object.type): this {
		if (object.cellBoundsGrid !== this.id) {
			return this;
		}

		const minX = object.cellMinX;
		const minY = object.cellMinY;
		const maxX = object.cellMaxX;
		const maxY = object.cellMaxY;

		this.entityCount--;
		object.cellBoundsGrid = -1;

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				const cell = this.cells[this.getCellID(x, y)];

				if (cell) {
					this.totalEntitiesInCells--;

					if (cell.typed) {
						cell.remove(object, type);
					} else {
						cell.remove(object);
					}
				}
			}
		}

		return this;
	}

	/**
	 * Make sure `object` sits in the cells it covers NOW, doing nothing when they are the
	 * cells it already sat in.
	 *
	 * For a grid that is maintained across ticks rather than rebuilt. The FOV thread used
	 * to clear its grid and re-insert its whole registry every networking tick — ~5,100
	 * records, ~0.75ms, a fifth of that thread — to account for the few hundred that had
	 * actually moved. It now places only what the core sent, and most of those have not
	 * changed cell either, so the common case here is the comparison and nothing else.
	 */
	public place(object: T, rangeX?: number, rangeY?: number, type: string = object.type): this {
		const bounds = this.getBounds(object, rangeX, rangeY);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const maxX = bounds[2]!;
		const maxY = bounds[3]!;

		if (object.cellBoundsGrid === this.id) {
			if (object.cellMinX === minX && object.cellMinY === minY && object.cellMaxX === maxX && object.cellMaxY === maxY) {
				return this;
			}

			this.removeByBounds(object, type);
		}

		return this.insert(object, rangeX, rangeY, type);
	}

	public remove(object: T, type: string = object.type): this {
		const cellsKeys: Set<number> = object.cellsKeys[this.id];

		this.entityCount--;

		for (const key of cellsKeys) {
			const cell = this.cells[key];

			if (cell) {
				this.totalEntitiesInCells--;

				if (cell.typed) {
					cell.remove(object, type, cellsKeys);
				} else {
					cell.remove(object, cellsKeys);
				}

				if (cell.count === 0) {
					this.cells[key] = null;
				}
			}
		}

		return this;
	}

	public update(object: T, rangeX?: number, rangeY?: number, type: string = object.type): this {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const maxX = bounds[2]!;
		const maxY = bounds[3]!;

		const oldCells = object.cellsKeys[this.id];
		const newCells = this.cellKeys;

		newCells.clear();

		// Every cell of the new range, not only the ones entered: `update` is only called
		// for an entity that moved or resized, and a move within a cell is an arrival
		// as far as a neighbour waiting to be touched is concerned.
		const version = ++this.activityVersion;

		this.setBounds(object, minX, minY, maxX, maxY);

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				const key = this.getCellID(x, y);

				this.cellActivity[key] = version;
				this.cellTouch[key] = version;

				if (!oldCells.has(key)) {
					const cell = this.getCell(key);

					this.totalEntitiesInCells++;

					if (cell.typed) {
						cell.insert(object, type);
					} else {
						cell.insert(object);
					}
				}

				newCells.add(key);
			}
		}

		for (const key of oldCells) {
			if (!newCells.has(key)) {
				const cell = this.cells[key];

				this.totalEntitiesInCells--;

				if (cell) {
					if (cell.typed) {
						cell.remove(object, type);
					} else {
						cell.remove(object);
					}
				}
			}
		}

		this.cellKeys = oldCells;
		object.cellsKeys[this.id] = newCells;

		return this;
	}

	public query<P extends any[] = any[]>(object: T, callback: QueryCallback<T, Types, P>, rangeX?: number, rangeY?: number, param1?: P[0], param2?: P[1]): boolean {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const maxX = bounds[2]!;
		const maxY = bounds[3]!;

		const queryID = this.incrementQueryID();

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				const key = this.getCellID(x, y);
				const cell = this.cells[key];

				// `count > 0` as well as non-null: the per-tick grids keep their cells across
				// `clear` (see there), so on those an allocated cell is usually an EMPTY one,
				// and the callback would otherwise be invoked to walk empty arrays — a typed
				// cell holds one per entity class. Cheaper to ask the cell.
				if (cell !== null && cell.count > 0) {
					const exit = callback.call(object, cell.objects as any, queryID, param1, param2);

					if (exit) {
						return true;
					}
				}
			}
		}

		return false;
	}

	public query2<D extends (keyof Types)[]>(object: T, rangeX?: number, rangeY?: number): Types extends undefined ? T[] : { [K in D[number]]: Types[K] extends Constructor<infer R> ? R[] : never } {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const maxX = bounds[2]!;
		const maxY = bounds[3]!;

		this.clearQuery2OutputCache();

		const queryID = this.incrementQueryID();
		let output = this.query2OutputCache;
		const types = this.typesKeys!;

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				const key = this.getCellID(x, y);
				const cell = this.cells[key];

				if (cell) {
					if (cell.typed) {
						for (let i = 0; i < types.length; i++) {
							const type = types[i];
							const objects = cell.objects[type];

							for (let j = 0; j < objects.length; j++) {
								const object = objects[j];

								if (object.queryID !== queryID) {
									output[type].push(object);

									object.queryID = queryID;
								}
							}
						}
					} else {
						for (let i = 0; i < cell.objects.length; i++) {
							const object = cell.objects[i];

							if (object.queryID !== queryID) {
								output.push(object);

								object.queryID = queryID;
							}
						}
					}
				}
			}
		}

		return output;
	}

	private incrementQueryID(): number {
		if (this.queryID === Number.MAX_SAFE_INTEGER - 1) {
			this.queryID = 0;
		} else {
			this.queryID++;
		}

		return this.queryID;
	}

	public clearQuery2OutputCache(): this {
		const cache = this.query2OutputCache;

		if (this.typed) {
			const types = this.typesKeys!;

			for (let i = 0; i < types.length; i++) {
				cache[types[i]].length = 0;
			}
		} else {
			cache.length = 0;
		}

		return this;
	}

	/**
	 * Run `callback` once for every pair of spawned entities that share a cell.
	 *
	 * An entity spanning several cells meets its neighbour in each of them, so pairs
	 * need deduplicating. This used to be a bitset over pair ids, sized by the square of
	 * the dynamic entity count and wiped every tick — with ~5,000 dynamic entities that
	 * was a 1.5MB memset a tick (the `fill` at ~2% of the game thread in profiles) plus
	 * a bit test per pair. Instead a pair now runs only in the FIRST cell both entities
	 * occupy: the ranges are rectangles, so their overlap is one, and its top-left cell
	 * is the max of the two minima that `insert` recorded. Exact, and nothing to clear.
	 */
	public pairsQuery(callback: PairsQueryCallback<T>): number {
		let count = 0;

		if (this.typed) {
			throw new Error("Typed cells are not supported for pairwiseCombination. Use Untyped cells instead.");
		}

		const stride = this.maxKeyX + 1;

		for (let key = 0; key < this.cells.length; key++) {
			const cell = this.cells[key] as UntypedCell<T> | null;

			if (cell === null || cell.count < 2) {
				continue;
			}

			const cellX = key % stride;
			const cellY = (key - cellX) / stride;

			for (let i = 0; i < cell.count; i++) {
				const entity1: T = cell.objects[i]!;

				if (!entity1.spawned) {
					continue;
				}

				const minX1 = entity1.cellMinX;
				const minY1 = entity1.cellMinY;

				for (let j = i + 1; j < cell.count; j++) {
					const entity2: T = cell.objects[j]!;

					if (!entity2.spawned) {
						continue;
					}

					const firstX = minX1 > entity2.cellMinX ? minX1 : entity2.cellMinX;
					const firstY = minY1 > entity2.cellMinY ? minY1 : entity2.cellMinY;

					if (firstX === cellX && firstY === cellY) {
						callback(entity1, entity2);

						count++;
					}
				}
			}
		}

		return count;
	}

	/**
	 * Empty every cell, KEEPING the cell objects.
	 *
	 * This runs once per game tick on the dynamic grid, so what it does with the cells
	 * is a per-frame allocation decision, not a one-off. It used to `fill(null)`, which
	 * threw away every occupied cell along with its `objects` array — and since
	 * `getCell` allocates on a null slot, the next tick's inserts built both again. At
	 * 60 TPS over a 34x30 grid that is thousands of `UntypedCell` + array allocations a
	 * second, all of them garbage a frame later, which is exactly the kind of churn that
	 * shows up as GC pauses in the tick time rather than as steady cost.
	 *
	 * The cell set is FIXED and bounded — one per grid square, allocated on first use —
	 * so there is nothing to reclaim by dropping them. Resetting each one instead walks
	 * the same array and allocates nothing; `Cell.clear` already empties the contents
	 * (`objects.length = 0` and `count = 0`), so entities are still released.
	 */
	private setBounds(object: T, minX: number, minY: number, maxX: number, maxY: number): void {
		object.cellMinX = minX;
		object.cellMinY = minY;
		object.cellMaxX = maxX;
		object.cellMaxY = maxY;
		object.cellBoundsGrid = this.id;
	}

	/**
	 * Mark the cells `object` covers as touched, WITHOUT putting it in the grid.
	 *
	 * For the entities that can act on this grid's contents without living in it: an
	 * animal is in the dynamic grid, finds food through `query`, and pushes it — so a
	 * food asleep in a cell an animal is crossing has to re-run its wake test, and
	 * nothing else would tell it so. Cheap enough to do on every move: a counter bump
	 * and one write per covered cell, no cell objects and no membership.
	 */
	public stamp(object: T, rangeX?: number, rangeY?: number): this {
		const bounds = this.getBounds(object, rangeX, rangeY);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const maxX = bounds[2]!;
		const maxY = bounds[3]!;

		const version = ++this.activityVersion;

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				this.cellTouch[this.getCellID(x, y)] = version;
			}
		}

		return this;
	}

	/** The current touch counter; pass it back to `touchedSince` later. */
	public get touch(): number {
		return this.activityVersion;
	}

	/**
	 * Whether anything happened after `version` in any cell `object` occupies — see
	 * `cellTouch`. Reads the rectangle `insert`/`update` recorded, so it never walks a
	 * Set: this is the stage-one wake test and it runs for every sleeping entity on
	 * every one of its ticks.
	 */
	public touchedSince(object: T, version: number): boolean {
		// The rectangle belongs to another grid, so it says nothing about this one: answer
		// "something happened" and let the caller do its exact check. Reachable only if an
		// entity is ever put in two grids at once — see `cellMinX` on the element type.
		if (object.cellBoundsGrid !== this.id) {
			return true;
		}

		const minX = object.cellMinX;
		const minY = object.cellMinY;
		const maxX = object.cellMaxX;
		const maxY = object.cellMaxY;
		const stride = this.maxKeyX + 1;
		const touch = this.cellTouch;

		for (let y = minY; y <= maxY; y++) {
			const row = y * stride;

			for (let x = minX; x <= maxX; x++) {
				if (touch[row + x]! > version) {
					return true;
				}
			}
		}

		return false;
	}

	/** The current activity counter; pass it back to `activitySince` later. */
	public get activity(): number {
		return this.activityVersion;
	}

	/** Whether anything was placed in or moved within any of `cellsKeys` after `version`. */
	public activitySince(cellsKeys: Set<number>, version: number): boolean {
		for (const key of cellsKeys) {
			if (this.cellActivity[key]! > version) {
				return true;
			}
		}

		return false;
	}

	public clear(clean?: Map<number, T>): this {
		for (let i = 0; i < this.cells.length; i++) {
			const cell = this.cells[i];

			// Only cells that hold something: `length = 0` is a native call even on an
			// empty array, and the dynamic grid clears every one of its ~1,100 cells
			// each tick while a few hundred are in use.
			if (cell && cell.count > 0) {
				cell.clear();
			}
		}

		if (clean) {
			for (const entity of clean.values()) {
				entity.cellsKeys[this.id].clear();
			}
		}

		this.totalEntitiesInCells = 0;
		this.entityCount = 0;

		return this;
	}

	public get cellCount(): number {
		return this.cells.length;
	}
}

abstract class BaseCell {
	private readonly key: number;
	public count: number;

	public constructor(key: number) {
		this.key = key;
		this.count = 0;
	}

	public add(cellsKeys?: Set<number>): void {
		cellsKeys?.add(this.key);

		this.count++;
	}

	public delete(cellsKeys?: Set<number>): void {
		cellsKeys?.delete(this.key);

		this.count--;
	}

	public clear(): void {
		this.count = 0;
	}
}

class UntypedCell<T extends Entity> extends BaseCell {
	public readonly typed: false;
	public readonly objects: T[];

	public constructor(key: number) {
		super(key);

		this.typed = false;
		this.objects = [];
	}

	public insert(object: T, cellsKeys?: Set<number>): void {
		this.objects.push(object);

		this.add(cellsKeys);
	}

	public remove(object: T, cellsKeys?: Set<number>): void {
		removeFromArray(this.objects, object);

		this.delete(cellsKeys);
	}

	public override clear(): void {
		this.objects.length = 0;

		super.clear();
	}
}

class TypedCell<T extends Entity, Types extends Record<string, Constructor<T>>> extends BaseCell {
	public readonly objects: { [K in keyof Types]: InstanceType<Types[K]>[] };
	public readonly typed = true;
	public readonly queryCache: { [K in keyof Types]: InstanceType<Types[K]>[] };

	public constructor(key: number, types: Types) {
		super(key);

		this.objects = {} as any;
		this.queryCache = {} as any;
		this.typed = true;

		for (const type in types) {
			this.objects[type] = [];
		}
	}

	public insert(object: T, type: keyof Types, cellsKeys?: Set<number>): void {
		const array = this.objects[type];

		if (!array) {
			throw new Error(`Type ${String(type)} is not defined in this cell`);
		}

		array.push(object as InstanceType<Types[typeof type]>);

		this.add(cellsKeys);
	}

	public remove(object: T, type: keyof Types, cellsKeys?: Set<number>): void {
		removeFromArray(this.objects[type], object);

		this.delete(cellsKeys);
	}

	public override clear(): void {
		for (const key in this.objects) {
			this.objects[key].length = 0;
		}

		super.clear();
	}
}

export { HashGrid2D as HashGrid, type QueryCallbackValue as QueryCallback, type PairQueryCallbackValue as PairQueryCallback };
