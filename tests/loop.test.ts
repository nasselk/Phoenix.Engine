import { describe, expect, test } from "bun:test";
import { GameLoop } from "../server/src/GameLoop";

async function run(turbo: boolean, seconds: number, onTick?: (deltaTime: number) => void): Promise<number[]> {
	const loop = new GameLoop({ TPS: 60, turbo });
	const steps: number[] = [];

	loop.on("tick", (deltaTime) => {
		steps.push(deltaTime);
		onTick?.(deltaTime);
	});

	loop.resume();
	await Bun.sleep(seconds * 1000);
	loop.pause();
	loop.destroy();

	return steps;
}

const sum = (steps: number[]) => steps.reduce((total, step) => total + step, 0);

describe("server loop", () => {
	test("in turbo, ticks close to its rate", async () => {
		const steps = await run(true, 2);

		expect(steps.length).toBeGreaterThanOrEqual(112);
		expect(steps.length).toBeLessThanOrEqual(121);
	});

	for (const turbo of [true, false]) {
		test(`never ticks faster than its rate, and its steps add up to the time that passed (turbo: ${turbo})`, async () => {
			const steps = await run(turbo, 2);

			expect(steps.length).toBeLessThanOrEqual(121);
			expect(Math.min(...steps)).toBeGreaterThanOrEqual(1 / 60 - 1e-9);
			expect(Math.abs(sum(steps) - 2)).toBeLessThan(0.1);
		});
	}

	test("caps a step at a tenth of a second after a stall", async () => {
		let stalled = false;

		const steps = await run(true, 0.5, () => {
			if (!stalled) {
				stalled = true;

				const until = performance.now() + 300;

				while (performance.now() < until) {}
			}
		});

		expect(Math.max(...steps)).toBeCloseTo(0.1, 5);
	});
});
