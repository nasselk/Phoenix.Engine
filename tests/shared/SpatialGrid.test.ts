import { describe, expect, test } from "bun:test";
import { Vector3 } from "../../shared/math/vector3";
import { SpatialGrid } from "../../shared/world/SpatialGrid";

function thing(x: number, y: number, z: number) {
	return { position: new Vector3(x, y, z) };
}

describe("SpatialGrid", () => {
	test("a query returns exactly what is within its radius, across cells and negative coordinates", () => {
		const grid = new SpatialGrid<ReturnType<typeof thing>>(10);
		const near = [thing(0, 0, 0), thing(-9, 0, 0), thing(5, 5, 5), thing(0, -14, 0)];
		const far = [thing(16, 0, 0), thing(-100, 0, 0), thing(0, 0, 15.1)];

		for (const item of [...near, ...far]) {
			grid.insert(item);
		}

		expect(new Set(grid.query({ x: 0, y: 0, z: 0 }, 15))).toEqual(new Set(near));
	});

	test("update re-files an item that moved, and remove forgets it", () => {
		const grid = new SpatialGrid<ReturnType<typeof thing>>(10);
		const item = thing(0, 0, 0);

		grid.insert(item);
		item.position.set(500, 0, 0);
		grid.update(item);

		expect(grid.query({ x: 0, y: 0, z: 0 }, 20)).toEqual([]);
		expect(grid.query({ x: 500, y: 0, z: 0 }, 1)).toEqual([item]);

		expect(grid.remove(item)).toBe(true);
		expect(grid.remove(item)).toBe(false);
		expect(grid.size).toBe(0);
		expect(grid.query({ x: 500, y: 0, z: 0 }, 1)).toEqual([]);
	});

	test("a query reuses the array it is given", () => {
		const grid = new SpatialGrid<ReturnType<typeof thing>>(10);
		const out = [thing(1, 1, 1)];

		grid.insert(thing(0, 0, 0));

		expect(grid.query({ x: 0, y: 0, z: 0 }, 5, out)).toBe(out);
		expect(out.length).toBe(1);
	});

	test("inserting twice moves instead of duplicating", () => {
		const grid = new SpatialGrid<ReturnType<typeof thing>>(10);
		const item = thing(0, 0, 0);

		grid.insert(item);
		item.position.set(25, 0, 0);
		grid.insert(item);

		expect(grid.size).toBe(1);
		expect(grid.query({ x: 25, y: 0, z: 0 }, 1)).toEqual([item]);
		expect(grid.query({ x: 0, y: 0, z: 0 }, 1)).toEqual([]);
	});
});
