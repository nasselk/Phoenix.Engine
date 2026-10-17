import { describe, expect, test } from "bun:test";
import { HashGrid3D } from "../../shared/world/HashGrid3D";

class Thing {
	public constructor(
		public readonly name: string,
		public readonly position = { x: 0, y: 0, z: 0 },
		public size = 0,
	) {}
}

class Player extends Thing {}

class Crate extends Thing {}

class BigCrate extends Crate {}

const bounds = { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 50 } };

function names(items: Thing[]): string[] {
	return items.map((item) => item.name).sort();
}

function overlaps(a: Thing, b: { position: { x: number; y: number; z: number }; size: number }): boolean {
	const reach = (a.size + b.size) / 2;

	return Math.abs(a.position.x - b.position.x) <= reach && Math.abs(a.position.y - b.position.y) <= reach && Math.abs(a.position.z - b.position.z) <= reach;
}

function scatter(count: number): Thing[] {
	return Array.from({ length: count }, (_, i) => new Thing(`t${i}`, { x: Math.random() * 120 - 60, y: Math.random() * 120 - 60, z: Math.random() * 120 - 60 }, Math.random() * 12));
}

describe("HashGrid3D", () => {
	test("query and pairs find exactly what overlaps, each once, as brute force does", () => {
		const grid = new HashGrid3D<Thing>({ cellSize: 7, bounds });
		const things = scatter(300);

		for (const thing of things) {
			grid.insert(thing, thing.size);
		}

		for (let i = 0; i < 50; i++) {
			const probe = new Thing("probe", { x: Math.random() * 120 - 60, y: Math.random() * 120 - 60, z: Math.random() * 120 - 60 }, Math.random() * 30);

			expect(names(grid.query(probe.position, probe.size))).toEqual(names(things.filter((thing) => overlaps(thing, probe))));
		}

		const pairs: string[] = [];
		const expected: string[] = [];

		grid.pairs((a, b) => pairs.push([a.name, b.name].sort().join("-")));

		for (let i = 0; i < things.length; i++) {
			for (let j = i + 1; j < things.length; j++) {
				if (overlaps(things[i]!, things[j]!)) {
					expected.push([things[i]!.name, things[j]!.name].sort().join("-"));
				}
			}
		}

		expect(pairs.sort()).toEqual(expected.sort());
	});

	test("update follows an item across cells and resizes it, and remove takes it out of every cell", () => {
		const grid = new HashGrid3D<Thing>({ cellSize: 4, bounds });
		const crate = new Thing("crate", { x: 0, y: 0, z: 0 });

		grid.insert(crate, 10);
		expect(names(grid.query({ x: 4.5, y: 4.5, z: 4.5 }))).toEqual(["crate"]);

		crate.position.x = 30;
		grid.update(crate);
		expect(grid.query({ x: 0, y: 0, z: 0 })).toEqual([]);
		expect(names(grid.query({ x: 34, y: 0, z: 0 }))).toEqual(["crate"]);

		grid.update(crate, 2);
		expect(grid.query({ x: 34, y: 0, z: 0 })).toEqual([]);

		expect(grid.remove(crate)).toBe(true);
		expect(grid.remove(crate)).toBe(false);
		expect(grid.has(crate)).toBe(false);
		expect(grid.query({ x: 30, y: 0, z: 0 }, 100)).toEqual([]);
	});

	test("items beyond the bounds are still found", () => {
		const grid = new HashGrid3D<Thing>({ cellSize: 10, bounds });
		const far = new Thing("far", { x: 500, y: -500, z: 80 });

		grid.insert(far);

		expect(names(grid.query({ x: 500, y: -500, z: 80 }, 1))).toEqual(["far"]);
		expect(grid.query({ x: 45, y: -45, z: 45 }, 1)).toEqual([]);
	});

	test("a typed grid hands items back by type, by class, subclass or a named type", () => {
		const grid = new HashGrid3D({ cellSize: 8, bounds, types: { player: Player, crate: Crate } });
		const player = new Player("player");
		const crate = new Crate("crate");
		const big = new BigCrate("big");
		const named = new Crate("named");

		grid.insert(player).insert(crate).insert(big).insert(named, 0, "player");

		const { player: players, crate: crates } = grid.query({ x: 0, y: 0, z: 0 }, 1);

		expect(names(players)).toEqual(["named", "player"]);
		expect(names(crates)).toEqual(["big", "crate"]);
		expect(() => grid.insert(new Thing("stranger") as Player)).toThrow("not one of this grid's types");
	});

	test("each visits until the callback returns true, only the named type when given", () => {
		const grid = new HashGrid3D({ cellSize: 8, bounds, types: { player: Player, crate: Crate } });

		for (let i = 0; i < 5; i++) {
			grid.insert(new Player(`p${i}`));
			grid.insert(new Crate(`c${i}`));
		}

		const visited: string[] = [];

		expect(grid.each({ x: 0, y: 0, z: 0 }, 1, (item) => void visited.push(item.name), "crate")).toBe(false);
		expect(visited.every((name) => name.startsWith("c"))).toBe(true);
		expect(visited).toHaveLength(5);

		let seen = 0;

		expect(grid.each({ x: 0, y: 0, z: 0 }, 1, () => ++seen === 3)).toBe(true);
		expect(seen).toBe(3);
	});

	test("a typed grid pairs items across types", () => {
		const grid = new HashGrid3D({ cellSize: 8, bounds, types: { player: Player, crate: Crate } });

		grid.insert(new Player("p", { x: 0, y: 0, z: 0 }), 2);
		grid.insert(new Crate("c", { x: 1, y: 0, z: 0 }), 2);
		grid.insert(new Crate("far", { x: 30, y: 0, z: 0 }), 2);

		const pairs: string[] = [];

		expect(grid.pairs((a, b) => pairs.push([a.name, b.name].sort().join("-")))).toBe(1);
		expect(pairs).toEqual(["c-p"]);
	});

	test("clear empties it for a rebuild, and resize keeps what it holds", () => {
		const grid = new HashGrid3D<Thing>({ cellSize: 10, bounds });
		const thing = new Thing("thing", { x: 20, y: 0, z: 0 });

		grid.insert(thing, 4);
		grid.clear();

		expect(grid.size).toBe(0);
		expect(grid.query({ x: 20, y: 0, z: 0 }, 10)).toEqual([]);
		expect(grid.has(thing)).toBe(false);
		expect(grid.remove(thing)).toBe(false);

		grid.insert(thing, 4);
		grid.resize({ min: { x: 0, y: 0, z: 0 }, max: { x: 200, y: 200, z: 200 } }, 25);

		expect(grid.size).toBe(1);
		expect(names(grid.query({ x: 21, y: 0, z: 0 }))).toEqual(["thing"]);
	});

	test("the grid cannot be changed or queried from inside each or pairs", () => {
		const grid = new HashGrid3D<Thing>({ cellSize: 10, bounds });

		grid.insert(new Thing("a"), 2).insert(new Thing("b"), 2);

		expect(() => grid.each({ x: 0, y: 0, z: 0 }, 1, (item) => void grid.remove(item))).toThrow("from inside its own each() or pairs()");
		expect(() => grid.pairs(() => grid.query({ x: 0, y: 0, z: 0 }))).toThrow("from inside its own each() or pairs()");
		expect(grid.size).toBe(2);
		expect(names(grid.query({ x: 0, y: 0, z: 0 }))).toEqual(["a", "b"]);
	});
});
