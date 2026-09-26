import { describe, expect, test } from "bun:test";
import { GameLoop } from "../server/src/GameLoop";

describe("server loop", () => {
	test("ticks at its rate on average, one fixed step each", async () => {
		const loop = new GameLoop({ TPS: 60 });
		const steps: number[] = [];

		loop.on("tick", (deltaTime) => steps.push(deltaTime));
		loop.resume();
		await Bun.sleep(2000);
		loop.pause();
		loop.destroy();

		expect(steps.length).toBeGreaterThanOrEqual(118);
		expect(steps.length).toBeLessThanOrEqual(121);
		expect(new Set(steps)).toEqual(new Set([1 / 60]));
	});
});
