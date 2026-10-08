import type { Vector3Structure } from "../math/vector3";

/** Anything with a position the grid can file. */
export type Positioned = { readonly position: Vector3Structure };

/**
 * Finds what is near a point without looking at everything: items are filed in cubic cells of
 * `cellSize`, and a query only reads the cells its sphere touches. Unbounded, and the items need no
 * fields of their own. For interest management, a room's visible set per player:
 *
 *   const grid = new SpatialGrid<PositionEntity<any>>(32);
 *   room.on("spawn", (entity) => entity instanceof PositionEntity && grid.insert(entity));
 *   room.on("destroy", (entity) => grid.remove(entity as PositionEntity<any>));
 *   // each tick, before the frames: grid.update(entity) for what moved, then
 *   room.frame(socket, grid.query(player.position, 60, visible));
 *
 * A cell size around the query radius works best. Cells are indexed by 16 bits per axis, so
 * positions must stay within 32,768 cells of the origin. A cell once used keeps its array, so moving
 * items allocate nothing; `clear()` frees them all.
 */
export class SpatialGrid<T extends Positioned> {
	private readonly cells = new Map<number, T[]>();
	private readonly keys = new Map<T, number>();

	public constructor(public readonly cellSize: number) {
		if (!(cellSize > 0)) {
			throw new RangeError("A grid's cell size must be above zero");
		}
	}

	/** File an item at its current position. Inserting one already in the grid moves it instead. */
	public insert(item: T): this {
		if (this.keys.has(item)) {
			return this.update(item);
		}

		const key = this.keyOf(item.position);

		this.cell(key).push(item);
		this.keys.set(item, key);

		return this;
	}

	/** Re-file an item after it moved. Cheap when it stayed in its cell, so it can run every tick. */
	public update(item: T): this {
		const previous = this.keys.get(item);

		if (previous === undefined) {
			return this.insert(item);
		}

		const key = this.keyOf(item.position);

		if (key !== previous) {
			this.take(previous, item);
			this.cell(key).push(item);
			this.keys.set(item, key);
		}

		return this;
	}

	public remove(item: T): boolean {
		const key = this.keys.get(item);

		if (key === undefined) {
			return false;
		}

		this.take(key, item);
		this.keys.delete(item);

		return true;
	}

	public has(item: T): boolean {
		return this.keys.has(item);
	}

	/**
	 * Every item within `radius` of `center`, by its filed position. Written into `out`, which is
	 * emptied first: reuse one array per caller and a query allocates nothing.
	 */
	public query(center: Vector3Structure, radius: number, out: T[] = []): T[] {
		out.length = 0;

		const size = this.cellSize;
		const radiusSquared = radius * radius;
		const minX = Math.floor((center.x - radius) / size);
		const minY = Math.floor((center.y - radius) / size);
		const minZ = Math.floor((center.z - radius) / size);
		const maxX = Math.floor((center.x + radius) / size);
		const maxY = Math.floor((center.y + radius) / size);
		const maxZ = Math.floor((center.z + radius) / size);

		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				for (let z = minZ; z <= maxZ; z++) {
					const cell = this.cells.get(SpatialGrid.pack(x, y, z));

					if (cell === undefined) {
						continue;
					}

					for (let i = 0; i < cell.length; i++) {
						const item = cell[i]!;
						const dx = item.position.x - center.x;
						const dy = item.position.y - center.y;
						const dz = item.position.z - center.z;

						if (dx * dx + dy * dy + dz * dz <= radiusSquared) {
							out.push(item);
						}
					}
				}
			}
		}

		return out;
	}

	public clear(): void {
		this.cells.clear();
		this.keys.clear();
	}

	public get size(): number {
		return this.keys.size;
	}

	private keyOf(position: Vector3Structure): number {
		const size = this.cellSize;

		return SpatialGrid.pack(Math.floor(position.x / size), Math.floor(position.y / size), Math.floor(position.z / size));
	}

	private static pack(x: number, y: number, z: number): number {
		return ((x & 0xffff) * 0x10000 + (y & 0xffff)) * 0x10000 + (z & 0xffff);
	}

	private cell(key: number): T[] {
		let cell = this.cells.get(key);

		if (cell === undefined) {
			cell = [];
			this.cells.set(key, cell);
		}

		return cell;
	}

	private take(key: number, item: T): void {
		const cell = this.cells.get(key);

		if (cell === undefined) {
			return;
		}

		const index = cell.indexOf(item);

		if (index !== -1) {
			cell[index] = cell[cell.length - 1]!;
			cell.pop();
		}
	}
}
