import { describe, expect, test } from "bun:test";
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
