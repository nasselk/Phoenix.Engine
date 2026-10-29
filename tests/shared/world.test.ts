import { describe, expect, test } from "bun:test";
import { World as ClientWorld } from "../../client/src/world/world";
import { defineEntities } from "../../shared/world/registry";
import { ClientBox, createMirror } from "../fixtures";

/** A box that writes down when it updates. */
class LoggedBox extends ClientBox {
	public static readonly log: string[] = [];

	public override update(deltaTime: number): void {
		LoggedBox.log.push("entity");

		super.update(deltaTime);
	}
}

describe("World", () => {
	test("beforeUpdate listeners run before any entity updates, and update listeners after", () => {
		const world = createMirror(defineEntities({ box: LoggedBox }));

		world.spawn("box");
		world.on("beforeUpdate", () => LoggedBox.log.push("beforeUpdate"));
		world.on("update", () => LoggedBox.log.push("update"));
		world.update(1 / 60);

		expect(LoggedBox.log).toEqual(["beforeUpdate", "entity", "update"]);
	});
});

describe("World destroy", () => {
	test("an entity destroyed during update stays in the map until the update ends, and leaves it at once otherwise", () => {
		const world = new ClientWorld({ entities: defineEntities({ box: ClientBox }), context: undefined, capacity: 2 });
		const during = world.spawn("box");
		const outside = world.spawn("box");

		world.on("update", () => {
			during.destroy();

			expect(world.entities.has(during.id)).toBe(true);
			expect(world.hasAvailableEntitySlots).toBe(true);
		});
		world.update(1 / 60);

		expect(world.entities.has(during.id)).toBe(false);

		outside.destroy();

		expect(world.entities.has(outside.id)).toBe(false);
	});
});

describe("World spawn", () => {
	test("a client entity spawns under a chosen id, and a taken one is refused", () => {
		const world = createMirror(defineEntities({ box: ClientBox }));
		const chosen = world.spawn("box", { id: -5 });

		expect(chosen.id).toBe(-5);
		expect(() => world.spawn("box", { id: -5 })).toThrow();
	});
});
