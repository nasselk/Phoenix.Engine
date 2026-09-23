import { Vector3, type Vector3Structure } from "../libs/math/vector3D";

import type { Constructor } from "../utils/types";

import { removeFromArray } from "../utils/utils";

import { clamp } from "../libs/math/utils";

type QueryCallback<T, Types, P extends any[]> = (objects: Types extends undefined ? T[] : { [K in keyof Types]: Types[K] extends Constructor<infer R> ? R[] : never }, queryID: number, param1: P[0], param2: P[1]) => boolean | void;
type PairsQueryCallback<T> = (entity1: T, entity2: T) => void;
type QueryCallbackValue<T extends HashGrid3D<any, any>> = Parameters<Parameters<T["query"]>[1]>[0];
type PairQueryCallbackValue<T extends HashGrid3D<any, any>> = Parameters<T["pairsQuery"]>[0];

interface Entity {
	id: number;
	readonly position: Vector3Structure;
	readonly size: Vector3Structure;
	readonly type: string;
	alive: boolean;
	cellsKeys: Set<number>[];
	queryID: number;
	cellMinX: number;
	cellMinY: number;
	cellMinZ: number;
}

class HashGrid3D<T extends Entity, Types extends Record<string, Constructor<T>> | undefined = undefined> {
	public static gridCount: number = 0;

	public readonly id: number;
	private cellWidth: number;
	private cellHeight: number;
	private cellDepth: number;
	private cells: (TypedCell<T, NonNullable<Types>> | UntypedCell<T> | null)[];
	/**
	 * Per cell, the `activity` counter's value when something was last placed in or
	 * moved within it. Lets an entity ask whether anything happened in its own cells
	 * since it last looked — see `activitySince` — which is what a stationary entity
	 * that reacts to arrivals (a food that splits when water is pushed into it) needs
	 * instead of rescanning its neighbourhood on every one of its ticks.
	 */
	private cellActivity: Uint32Array;
	private activityVersion: number;

	private readonly removableObjects: boolean;
	private readonly boundsBuffer: Uint32Array;
	private maxKeyX: number;
	private maxKeyY: number;
	private maxKeyZ: number;
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
		min: Vector3;
		max: Vector3;
	};

	public constructor(cellWidth: number, cellHeight: number = cellWidth, cellDepth: number = cellHeight, bounds: { min: Vector3Structure; max: Vector3Structure }, removableObjects: boolean = true, types?: Types) {
		this.bounds = {
			min: new Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
			max: new Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
		};
		this.id = HashGrid3D.gridCount++;
		this.cellWidth = Math.max(cellWidth, 1);
		this.cellHeight = Math.max(cellHeight, 1);
		this.cellDepth = Math.max(cellDepth, 1);
		this.removableObjects = removableObjects;
		this.maxKeyX = Math.ceil((this.bounds.max.x - this.bounds.min.x) / this.cellWidth);
		this.maxKeyY = Math.ceil((this.bounds.max.y - this.bounds.min.y) / this.cellHeight);
		this.maxKeyZ = Math.ceil((this.bounds.max.z - this.bounds.min.z) / this.cellDepth);
		this.maxKey = this.getCellID(this.maxKeyX, this.maxKeyY, this.maxKeyZ);
		this.cells = new Array(this.maxKey + 1).fill(null);
		this.cellActivity = new Uint32Array(this.maxKey + 1);
		this.boundsBuffer = new Uint32Array(6);
		this.activityVersion = 0;
		this.typed = Boolean(types);
		this.cellKeys = new Set();
		this.types = types;
		this.totalEntitiesInCells = 0;
		this.entityCount = 0;
		this.queryID = 0;

		if (this.typed) {
			this.query2OutputCache = Object.keys(this.types!).reduce(
				(acc, type) => {
					acc[type as keyof Types] = [] as never;

					return acc;
				},
				{} as { [K in keyof Types]: Types[K] extends Constructor<infer R> ? R[] : never },
			);

			this.typesKeys = Object.keys(this.types!) as (keyof Types)[];
		} else {
			this.query2OutputCache = [];
		}
	}

	public resize(bounds: { min: Vector3Structure; max: Vector3Structure }, cellWidth = this.cellWidth, cellHeight = this.cellHeight, cellDepth = this.cellDepth, restore: boolean = true): this {
		const cells = this.cells;
		const entities = new Set<T>();

		this.bounds.min.set(bounds.min);
		this.bounds.max.set(bounds.max);
		this.cellWidth = Math.max(cellWidth, 1);
		this.cellHeight = Math.max(cellHeight, 1);
		this.cellDepth = Math.max(cellDepth, 1);
		this.maxKeyX = Math.ceil((this.bounds.max.x - this.bounds.min.x) / this.cellWidth);
		this.maxKeyY = Math.ceil((this.bounds.max.y - this.bounds.min.y) / this.cellHeight);
		this.maxKeyZ = Math.ceil((this.bounds.max.z - this.bounds.min.z) / this.cellDepth);
		this.maxKey = this.getCellID(this.maxKeyX, this.maxKeyY, this.maxKeyZ);
		this.cells = new Array(this.maxKey + 1).fill(null);
		this.cellActivity = new Uint32Array(this.maxKey + 1);
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
				this.insert(entity, entity.size.x, entity.size.y, entity.size.z, entity.type);
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

	private getCellID(x: number, y: number, z: number): number {
		return (z * (this.maxKeyY + 1) + y) * (this.maxKeyX + 1) + x; // Row-major order
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

	private getBounds(object: T, rangeX: number = object.size.x, rangeY: number = object.size.y, rangeZ: number = object.size.z): Uint32Array {
		const localX = object.position.x - this.bounds.min.x;
		const localY = object.position.y - this.bounds.min.y;
		const localZ = object.position.z - this.bounds.min.z;

		// Clamp and truncate
		this.boundsBuffer[0] = clamp((localX - rangeX / 2) / this.cellWidth, 0, this.maxKeyX) | 0;
		this.boundsBuffer[1] = clamp((localY - rangeY / 2) / this.cellHeight, 0, this.maxKeyY) | 0;
		this.boundsBuffer[2] = clamp((localZ - rangeZ / 2) / this.cellDepth, 0, this.maxKeyZ) | 0;
		this.boundsBuffer[3] = clamp((localX + rangeX / 2) / this.cellWidth, 0, this.maxKeyX) | 0;
		this.boundsBuffer[4] = clamp((localY + rangeY / 2) / this.cellHeight, 0, this.maxKeyY) | 0;
		this.boundsBuffer[5] = clamp((localZ + rangeZ / 2) / this.cellDepth, 0, this.maxKeyZ) | 0;

		return this.boundsBuffer;
	}

	public insert(object: T, rangeX?: number, rangeY?: number, rangeZ?: number, type: string = object.type): this {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const minZ = bounds[2]!;
		const maxX = bounds[3]!;
		const maxY = bounds[4]!;
		const maxZ = bounds[5]!;

		let cellsKeys: Set<number> | undefined;

		if (this.removableObjects) {
			cellsKeys = object.cellsKeys[this.id];

			//	if (!cellsKeys) {
			cellsKeys = new Set();

			object.cellsKeys[this.id] = cellsKeys;
			//	} else if (cellsKeys.size > 0) {
			//		throw new Error("Object is already in the grid"); DISABLED BECAUSE OF TREES
			//	}
		} else {
			// For pairsQuery: the per-tick grids are the only ones that run it, and an
			// entity is inserted into exactly one of them per tick.
			object.cellMinX = minX;
			object.cellMinY = minY;
			object.cellMinZ = minZ;
		}

		this.entityCount++;

		const version = ++this.activityVersion;

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				for (let z = minZ; z <= maxZ; z++) {
					const key: number = this.getCellID(x, y, z);

					this.cellActivity[key] = version;

					const cell = this.getCell(key);

					this.totalEntitiesInCells++;

					if (cell.typed) {
						cell.insert(object, type, cellsKeys);
					} else {
						cell.insert(object, cellsKeys);
					}
				}
			}
		}

		return this;
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

	public update(object: T, rangeX?: number, rangeY?: number, rangeZ?: number, type: string = object.type): this {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const minZ = bounds[2]!;
		const maxX = bounds[3]!;
		const maxY = bounds[4]!;
		const maxZ = bounds[5]!;

		const oldCells = object.cellsKeys[this.id];
		const newCells = this.cellKeys;

		newCells.clear();

		// Every cell of the new range, not only the ones entered: `update` is only called
		// for an entity that moved or resized, and a move within a cell is an arrival
		// as far as a neighbour waiting to be touched is concerned.
		const version = ++this.activityVersion;

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				for (let z = minZ; z <= maxZ; z++) {
					const key = this.getCellID(x, y, z);

					this.cellActivity[key] = version;

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

	public query<P extends any[] = any[]>(object: T, callback: QueryCallback<T, Types, P>, rangeX?: number, rangeY?: number, rangeZ?: number, param1?: P[0], param2?: P[1]): boolean {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const minZ = bounds[2]!;
		const maxX = bounds[3]!;
		const maxY = bounds[4]!;
		const maxZ = bounds[5]!;

		const queryID = this.incrementQueryID();

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				for (let z = minZ; z <= maxZ; z++) {
					const key = this.getCellID(x, y, z);
					const cell = this.cells[key];

					if (cell) {
						const exit = callback.call(object, cell.objects as any, queryID, param1, param2);

						if (exit) {
							return true;
						}
					}
				}
			}
		}

		return false;
	}

	public query2<D extends (keyof Types)[]>(object: T, rangeX?: number, rangeY?: number, rangeZ?: number): Types extends undefined ? T[] : { [K in D[number]]: Types[K] extends Constructor<infer R> ? R[] : never } {
		// Indexed reads, not a destructure: destructuring a typed array goes through the
		// iterator protocol and allocates per call, and this runs for every entity on
		// every tick — it was ~3.5% of the game thread.
		const bounds = this.getBounds(object, rangeX, rangeY, rangeZ);
		const minX = bounds[0]!;
		const minY = bounds[1]!;
		const minZ = bounds[2]!;
		const maxX = bounds[3]!;
		const maxY = bounds[4]!;
		const maxZ = bounds[5]!;

		this.clearQuery2OutputCache();

		const queryID = this.incrementQueryID();
		let output = this.query2OutputCache;
		const types = this.typesKeys!;

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				for (let z = minZ; z <= maxZ; z++) {
					const key = this.getCellID(x, y, z);
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
	 * occupy: the ranges are boxes, so their overlap is one, and its minimum corner cell
	 * is the max of the two minima that `insert` recorded. Exact, and nothing to clear.
	 */
	public pairsQuery(callback: PairsQueryCallback<T>): number {
		let count = 0;

		if (this.typed) {
			throw new Error("Typed cells are not supported for pairwiseCombination. Use Untyped cells instead.");
		}

		const stride = this.maxKeyX + 1;
		const slice = stride * (this.maxKeyY + 1);

		for (let key = 0; key < this.cells.length; key++) {
			const cell = this.cells[key] as UntypedCell<T> | null;

			if (cell === null || cell.count < 2) {
				continue;
			}

			const rest = key % slice;
			const cellZ = (key - rest) / slice;
			const cellX = rest % stride;
			const cellY = (rest - cellX) / stride;

			for (let i = 0; i < cell.count; i++) {
				const entity1: T = cell.objects[i]!;

				if (!entity1.alive) {
					continue;
				}

				const minX1 = entity1.cellMinX;
				const minY1 = entity1.cellMinY;
				const minZ1 = entity1.cellMinZ;

				for (let j = i + 1; j < cell.count; j++) {
					const entity2: T = cell.objects[j]!;

					if (!entity2.alive) {
						continue;
					}

					const firstX = minX1 > entity2.cellMinX ? minX1 : entity2.cellMinX;
					const firstY = minY1 > entity2.cellMinY ? minY1 : entity2.cellMinY;
					const firstZ = minZ1 > entity2.cellMinZ ? minZ1 : entity2.cellMinZ;

					if (firstX === cellX && firstY === cellY && firstZ === cellZ) {
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

export { HashGrid3D as HashGrid, type QueryCallbackValue as QueryCallback, type PairQueryCallbackValue as PairQueryCallback };
