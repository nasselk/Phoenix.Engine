import type { Vector3Structure } from "../math/vector3";
import { clamp } from "../math/utils";
import { removeFromArray } from "../utils/utils";
import type { Positioned } from "./SpatialGrid";

/** The classes a typed grid sorts its items into, by name. */
export type HashGridTypes = Record<string, abstract new (...args: any[]) => Positioned>;

type TypeKey<Types> = Types extends HashGridTypes ? keyof Types & string : never;

type ItemOf<T, Types> = Types extends HashGridTypes ? InstanceType<Types[keyof Types]> : T;

type ItemOfType<T, Types, K> = Types extends HashGridTypes ? (K extends keyof Types ? InstanceType<Types[K]> : never) : T;

/** What `query` fills: an array of items, or on a typed grid one array per type. */
export type HashGridResult<T, Types> = Types extends HashGridTypes ? { [K in keyof Types]: InstanceType<Types[K]>[] } : T[];

export type HashGridOptions<Types> = {
	/** A cell's size, the same on every axis or one per axis. Around the size of a typical query works best. */
	readonly cellSize: number | Vector3Structure;
	/** The space the cells cover. Items beyond it are filed in the edge cells, so they are still found, only less cheaply. */
	readonly bounds: { readonly min: Vector3Structure; readonly max: Vector3Structure };
	/** Sorts items into one bucket per class, so a query can hand them back by type. */
	readonly types?: Types;
};

class Filed<T> {
	public item!: T;
	public bucket = 0;
	public halfX = 0;
	public halfY = 0;
	public halfZ = 0;
	public minX = 0;
	public minY = 0;
	public minZ = 0;
	public maxX = 0;
	public maxY = 0;
	public maxZ = 0;
	public cellMinX = 0;
	public cellMinY = 0;
	public cellMinZ = 0;
	public cellMaxX = 0;
	public cellMaxY = 0;
	public cellMaxZ = 0;
	public queryID = 0;
	public generation = 0;
}

class Cell<T> {
	public count = 0;
	public readonly buckets: Filed<T>[][];

	public constructor(buckets: number) {
		this.buckets = Array.from({ length: buckets }, () => []);
	}
}

/**
 * Items with a size, filed in every cell of a bounded 3D grid that their box touches, for queries by
 * box, early-exit visits and every overlapping pair. Typed, it sorts items by class and hands them
 * back by type. For points within a radius, `SpatialGrid` is simpler.
 *
 *   const grid = new HashGrid3D({ cellSize: 8, bounds, types: { player: Player, crate: Crate } });
 *   grid.insert(crate, crate.size);
 *   const { player, crate } = grid.query(center, 20);
 *
 * Moving within its cells costs an item nothing, `clear()` keeps every cell for the next rebuild, and
 * records are pooled, so a grid rebuilt or updated every tick allocates nothing once warm. Items
 * need no fields of their own. Nothing may change or query the grid from inside `each` or `pairs`.
 */
export class HashGrid3D<T extends Positioned = Positioned, Types extends HashGridTypes | undefined = undefined> {
	private readonly records: Map<ItemOf<T, Types>, Filed<ItemOf<T, Types>>>;
	private readonly pool: Filed<ItemOf<T, Types>>[];
	private readonly typeKeys: string[];
	private readonly typeIndex: Map<string, number>;
	private readonly classes: HashGridTypes[string][];
	private readonly classIndex: Map<Function, number>;
	private readonly result: HashGridResult<ItemOf<T, Types>, Types>;
	private cells: (Cell<ItemOf<T, Types>> | null)[];
	private originX: number;
	private originY: number;
	private originZ: number;
	private cellX: number;
	private cellY: number;
	private cellZ: number;
	private countX: number;
	private countY: number;
	private countZ: number;
	private halfX: number;
	private halfY: number;
	private halfZ: number;
	private rangeMinX: number;
	private rangeMinY: number;
	private rangeMinZ: number;
	private rangeMaxX: number;
	private rangeMaxY: number;
	private rangeMaxZ: number;
	private queryID: number;
	private busy: boolean;
	private generation: number;
	private live: number;

	public constructor({ cellSize, bounds, types }: HashGridOptions<Types>) {
		this.records = new Map();
		this.pool = [];
		this.typeKeys = types === undefined ? [] : Object.keys(types);
		this.typeIndex = new Map(this.typeKeys.map((key, index) => [key, index]));
		this.classes = this.typeKeys.map((key) => types![key]!);
		this.classIndex = new Map(this.classes.map((type, index) => [type, index]));
		this.result = (types === undefined ? [] : Object.fromEntries(this.typeKeys.map((key) => [key, []]))) as unknown as HashGridResult<ItemOf<T, Types>, Types>;
		this.cells = [];
		this.originX = this.originY = this.originZ = 0;
		this.cellX = this.cellY = this.cellZ = 1;
		this.countX = this.countY = this.countZ = 1;
		this.halfX = this.halfY = this.halfZ = 0;
		this.rangeMinX = this.rangeMinY = this.rangeMinZ = 0;
		this.rangeMaxX = this.rangeMaxY = this.rangeMaxZ = 0;
		this.queryID = 0;
		this.busy = false;
		this.generation = 1;
		this.live = 0;

		this.layout(bounds, cellSize);
	}

	/** File an item, its box `size` wide (a point by default). Inserting one already in the grid updates it instead. On a typed grid, its type is its class unless named. */
	public insert(item: ItemOf<T, Types>, size?: number | Vector3Structure, type?: TypeKey<Types>): this {
		this.assertIdle();

		let record = this.records.get(item);

		if (record?.generation === this.generation) {
			return this.update(item, size);
		}

		if (record === undefined) {
			record = this.pool.pop() ?? new Filed<ItemOf<T, Types>>();
			record.item = item;

			this.records.set(item, record);
		}

		record.generation = this.generation;
		record.bucket = this.bucketOf(item, type);
		record.queryID = 0;

		this.readSize(size);
		record.halfX = this.halfX;
		record.halfY = this.halfY;
		record.halfZ = this.halfZ;

		this.place(record);
		this.file(record);
		this.live++;

		return this;
	}

	/** Re-file an item after it moved, or resized when `size` is given. Free while it stays in the same cells, so it can run every tick. */
	public update(item: ItemOf<T, Types>, size?: number | Vector3Structure): this {
		this.assertIdle();

		const record = this.records.get(item);

		if (record?.generation !== this.generation) {
			return this.insert(item, size);
		}

		if (size !== undefined) {
			this.readSize(size);
			record.halfX = this.halfX;
			record.halfY = this.halfY;
			record.halfZ = this.halfZ;
		}

		const { cellMinX, cellMinY, cellMinZ, cellMaxX, cellMaxY, cellMaxZ } = record;

		this.place(record);

		if (record.cellMinX !== cellMinX || record.cellMinY !== cellMinY || record.cellMinZ !== cellMinZ || record.cellMaxX !== cellMaxX || record.cellMaxY !== cellMaxY || record.cellMaxZ !== cellMaxZ) {
			this.unfile(record.bucket, record, cellMinX, cellMinY, cellMinZ, cellMaxX, cellMaxY, cellMaxZ);
			this.file(record);
		}

		return this;
	}

	public remove(item: ItemOf<T, Types>): boolean {
		this.assertIdle();

		const record = this.records.get(item);

		if (record?.generation !== this.generation) {
			return false;
		}

		this.unfile(record.bucket, record, record.cellMinX, record.cellMinY, record.cellMinZ, record.cellMaxX, record.cellMaxY, record.cellMaxZ);
		this.records.delete(item);
		this.release(record);
		this.live--;

		return true;
	}

	public has(item: ItemOf<T, Types>): boolean {
		return this.records.get(item)?.generation === this.generation;
	}

	/**
	 * Every item whose filed box overlaps the box `size` wide around `center`, once each. Written into
	 * `out`, emptied first; without one, into an array (or object of arrays) the grid reuses on its
	 * next query, so copy what must outlive it.
	 */
	public query(center: Vector3Structure, size: number | Vector3Structure = 0, out: HashGridResult<ItemOf<T, Types>, Types> = this.result): HashGridResult<ItemOf<T, Types>, Types> {
		this.assertIdle();

		const typed = this.typeKeys.length > 0;

		if (typed) {
			for (const key of this.typeKeys) {
				(out as { [key: string]: unknown[] })[key]!.length = 0;
			}
		} else {
			(out as unknown[]).length = 0;
		}

		this.aim(center, size);

		const queryID = this.nextQueryID();

		for (let z = this.rangeMinZ; z <= this.rangeMaxZ; z++) {
			for (let y = this.rangeMinY; y <= this.rangeMaxY; y++) {
				for (let x = this.rangeMinX; x <= this.rangeMaxX; x++) {
					const cell = this.cells[this.index(x, y, z)];

					if (cell === null || cell === undefined || cell.count === 0) {
						continue;
					}

					for (let bucket = 0; bucket < cell.buckets.length; bucket++) {
						const records = cell.buckets[bucket]!;
						const target = typed ? (out as { [key: string]: unknown[] })[this.typeKeys[bucket]!]! : (out as unknown[]);

						for (let i = 0; i < records.length; i++) {
							const record = records[i]!;

							if (record.queryID !== queryID) {
								record.queryID = queryID;

								if (this.overlapsQuery(record, center)) {
									target.push(record.item);
								}
							}
						}
					}
				}
			}
		}

		return out;
	}

	/**
	 * Calls `callback` once for every item whose filed box overlaps the box `size` wide around
	 * `center`, only those of `type` when one is named, until it returns true. Returns whether it did.
	 */
	public each<K extends TypeKey<Types> = TypeKey<Types>>(center: Vector3Structure, size: number | Vector3Structure, callback: (item: ItemOfType<T, Types, K>) => boolean | void, type?: K): boolean {
		this.assertIdle();

		this.aim(center, size);

		const queryID = this.nextQueryID();
		const only = type === undefined ? -1 : this.typeIndex.get(type)!;

		this.busy = true;

		try {
			for (let z = this.rangeMinZ; z <= this.rangeMaxZ; z++) {
				for (let y = this.rangeMinY; y <= this.rangeMaxY; y++) {
					for (let x = this.rangeMinX; x <= this.rangeMaxX; x++) {
						const cell = this.cells[this.index(x, y, z)];

						if (cell === null || cell === undefined || cell.count === 0) {
							continue;
						}

						for (let bucket = only === -1 ? 0 : only; bucket < (only === -1 ? cell.buckets.length : only + 1); bucket++) {
							const records = cell.buckets[bucket]!;

							for (let i = 0; i < records.length; i++) {
								const record = records[i]!;

								if (record.queryID !== queryID) {
									record.queryID = queryID;

									if (this.overlapsQuery(record, center) && callback(record.item as ItemOfType<T, Types, K>)) {
										return true;
									}
								}
							}
						}
					}
				}
			}
		} finally {
			this.busy = false;
		}

		return false;
	}

	/** Calls `callback` once for every two items whose filed boxes overlap, of any types. Returns how many pairs it found. */
	public pairs(callback: (first: ItemOf<T, Types>, second: ItemOf<T, Types>) => void): number {
		this.assertIdle();

		let count = 0;
		let index = 0;

		this.busy = true;

		try {
			for (let z = 0; z < this.countZ; z++) {
				for (let y = 0; y < this.countY; y++) {
					for (let x = 0; x < this.countX; x++, index++) {
						const cell = this.cells[index];

						if (cell === null || cell === undefined || cell.count < 2) {
							continue;
						}

						const { buckets } = cell;

						for (let firstBucket = 0; firstBucket < buckets.length; firstBucket++) {
							const firsts = buckets[firstBucket]!;

							for (let i = 0; i < firsts.length; i++) {
								const first = firsts[i]!;

								for (let secondBucket = firstBucket; secondBucket < buckets.length; secondBucket++) {
									const seconds = buckets[secondBucket]!;

									for (let j = secondBucket === firstBucket ? i + 1 : 0; j < seconds.length; j++) {
										const second = seconds[j]!;

										if (HashGrid3D.firstShared(first, second, x, y, z) && HashGrid3D.overlap(first, second)) {
											callback(first.item, second.item);

											count++;
										}
									}
								}
							}
						}
					}
				}
			}
		} finally {
			this.busy = false;
		}

		return count;
	}

	/** Empties the grid, keeping its cells, and the records of the items inserted since the last clear for when they are inserted again. */
	public clear(): this {
		this.assertIdle();

		for (let i = 0; i < this.cells.length; i++) {
			const cell = this.cells[i];

			if (cell !== null && cell !== undefined && cell.count > 0) {
				for (const bucket of cell.buckets) {
					bucket.length = 0;
				}

				cell.count = 0;
			}
		}

		this.records.forEach(this.prune);
		this.generation++;
		this.live = 0;

		return this;
	}

	/** Covers new bounds, or uses a new cell size, keeping every item where it was filed. */
	public resize(bounds: HashGridOptions<Types>["bounds"], cellSize: number | Vector3Structure = { x: this.cellX, y: this.cellY, z: this.cellZ }): this {
		this.assertIdle();

		this.layout(bounds, cellSize);

		for (const record of this.records.values()) {
			if (record.generation === this.generation) {
				this.place(record);
				this.file(record);
			}
		}

		return this;
	}

	/** How many items it holds. */
	public get size(): number {
		return this.live;
	}

	public get cellCount(): number {
		return this.cells.length;
	}

	private layout(bounds: HashGridOptions<Types>["bounds"], cellSize: number | Vector3Structure): void {
		const sizeX = typeof cellSize === "number" ? cellSize : cellSize.x;
		const sizeY = typeof cellSize === "number" ? cellSize : cellSize.y;
		const sizeZ = typeof cellSize === "number" ? cellSize : cellSize.z;

		if (!(sizeX > 0 && sizeY > 0 && sizeZ > 0)) {
			throw new RangeError("A grid's cell size must be above zero");
		}

		if (!(bounds.max.x >= bounds.min.x && bounds.max.y >= bounds.min.y && bounds.max.z >= bounds.min.z)) {
			throw new RangeError("A grid's bounds must have their max at or above their min");
		}

		this.originX = bounds.min.x;
		this.originY = bounds.min.y;
		this.originZ = bounds.min.z;
		this.cellX = sizeX;
		this.cellY = sizeY;
		this.cellZ = sizeZ;
		this.countX = Math.max(Math.ceil((bounds.max.x - bounds.min.x) / sizeX), 1);
		this.countY = Math.max(Math.ceil((bounds.max.y - bounds.min.y) / sizeY), 1);
		this.countZ = Math.max(Math.ceil((bounds.max.z - bounds.min.z) / sizeZ), 1);
		this.cells = new Array(this.countX * this.countY * this.countZ).fill(null);
	}

	private index(x: number, y: number, z: number): number {
		return (z * this.countY + y) * this.countX + x;
	}

	private cellOf(value: number, origin: number, size: number, count: number): number {
		return clamp((value - origin) / size, 0, count - 1) | 0;
	}

	private readSize(size: number | Vector3Structure | undefined): void {
		if (size === undefined) {
			this.halfX = this.halfY = this.halfZ = 0;
		} else if (typeof size === "number") {
			this.halfX = this.halfY = this.halfZ = size / 2;
		} else {
			this.halfX = size.x / 2;
			this.halfY = size.y / 2;
			this.halfZ = size.z / 2;
		}
	}

	private place(record: Filed<ItemOf<T, Types>>): void {
		const { x, y, z } = record.item.position;

		record.minX = x - record.halfX;
		record.minY = y - record.halfY;
		record.minZ = z - record.halfZ;
		record.maxX = x + record.halfX;
		record.maxY = y + record.halfY;
		record.maxZ = z + record.halfZ;
		record.cellMinX = this.cellOf(record.minX, this.originX, this.cellX, this.countX);
		record.cellMinY = this.cellOf(record.minY, this.originY, this.cellY, this.countY);
		record.cellMinZ = this.cellOf(record.minZ, this.originZ, this.cellZ, this.countZ);
		record.cellMaxX = this.cellOf(record.maxX, this.originX, this.cellX, this.countX);
		record.cellMaxY = this.cellOf(record.maxY, this.originY, this.cellY, this.countY);
		record.cellMaxZ = this.cellOf(record.maxZ, this.originZ, this.cellZ, this.countZ);
	}

	private aim(center: Vector3Structure, size: number | Vector3Structure): void {
		this.readSize(size);

		this.rangeMinX = this.cellOf(center.x - this.halfX, this.originX, this.cellX, this.countX);
		this.rangeMinY = this.cellOf(center.y - this.halfY, this.originY, this.cellY, this.countY);
		this.rangeMinZ = this.cellOf(center.z - this.halfZ, this.originZ, this.cellZ, this.countZ);
		this.rangeMaxX = this.cellOf(center.x + this.halfX, this.originX, this.cellX, this.countX);
		this.rangeMaxY = this.cellOf(center.y + this.halfY, this.originY, this.cellY, this.countY);
		this.rangeMaxZ = this.cellOf(center.z + this.halfZ, this.originZ, this.cellZ, this.countZ);
	}

	private file(record: Filed<ItemOf<T, Types>>): void {
		for (let z = record.cellMinZ; z <= record.cellMaxZ; z++) {
			for (let y = record.cellMinY; y <= record.cellMaxY; y++) {
				for (let x = record.cellMinX; x <= record.cellMaxX; x++) {
					const index = this.index(x, y, z);
					const cell = this.cells[index] ?? (this.cells[index] = new Cell(Math.max(this.typeKeys.length, 1)));

					cell.buckets[record.bucket]!.push(record);
					cell.count++;
				}
			}
		}
	}

	private unfile(bucket: number, record: Filed<ItemOf<T, Types>>, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
		for (let z = minZ; z <= maxZ; z++) {
			for (let y = minY; y <= maxY; y++) {
				for (let x = minX; x <= maxX; x++) {
					const cell = this.cells[this.index(x, y, z)];

					if (cell !== null && cell !== undefined) {
						removeFromArray(cell.buckets[bucket]!, record);
						cell.count--;
					}
				}
			}
		}
	}

	/** Drops the records of items not inserted again since the last clear, so the grid forgets what it no longer holds. */
	private readonly prune = (record: Filed<ItemOf<T, Types>>, item: ItemOf<T, Types>): void => {
		if (record.generation !== this.generation) {
			this.records.delete(item);
			this.release(record);
		}
	};

	private release(record: Filed<ItemOf<T, Types>>): void {
		record.item = undefined as never;

		this.pool.push(record);
	}

	private bucketOf(item: ItemOf<T, Types>, type: string | undefined): number {
		if (this.typeKeys.length === 0) {
			return 0;
		}

		if (type !== undefined) {
			const bucket = this.typeIndex.get(type);

			if (bucket === undefined) {
				throw new Error(`"${type}" is not one of this grid's types`);
			}

			return bucket;
		}

		const exact = this.classIndex.get((item as object).constructor);

		if (exact !== undefined) {
			return exact;
		}

		for (let bucket = 0; bucket < this.classes.length; bucket++) {
			if (item instanceof this.classes[bucket]!) {
				return bucket;
			}
		}

		throw new Error(`${(item as object).constructor.name} is not one of this grid's types`);
	}

	private overlapsQuery(record: Filed<ItemOf<T, Types>>, center: Vector3Structure): boolean {
		return record.minX <= center.x + this.halfX && record.maxX >= center.x - this.halfX && record.minY <= center.y + this.halfY && record.maxY >= center.y - this.halfY && record.minZ <= center.z + this.halfZ && record.maxZ >= center.z - this.halfZ;
	}

	private nextQueryID(): number {
		this.queryID = this.queryID === Number.MAX_SAFE_INTEGER ? 1 : this.queryID + 1;

		return this.queryID;
	}

	private assertIdle(): void {
		if (this.busy) {
			throw new Error("A grid cannot be changed or queried from inside its own each() or pairs()");
		}
		
	}

	/** Whether this cell is the first both boxes cover, where their pair is counted: their overlap is a box, and its first cell is the larger of their minima. */
	private static firstShared(first: Filed<unknown>, second: Filed<unknown>, x: number, y: number, z: number): boolean {
		return Math.max(first.cellMinX, second.cellMinX) === x && Math.max(first.cellMinY, second.cellMinY) === y && Math.max(first.cellMinZ, second.cellMinZ) === z;
	}

	private static overlap(first: Filed<unknown>, second: Filed<unknown>): boolean {
		return first.minX <= second.maxX && first.maxX >= second.minX && first.minY <= second.maxY && first.maxY >= second.minY && first.minZ <= second.maxZ && first.maxZ >= second.minZ;
	}
}
