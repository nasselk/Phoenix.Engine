import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { extractRGBA } from "../../shared/utils/color";
import { Interval, Timeout, Timer } from "../../shared/utils/timers/timer";

describe("Timer", () => {
	let now = 0;

	beforeEach(() => {
		now = 1000;
		spyOn(performance, "now").mockImplementation(() => now);
	});

	afterEach(() => {
		Timer.clear();
		mock.restore();
	});

	test("a timeout fires once its delay has passed, not counting paused time", () => {
		let fired = 0;
		const timeout = new Timeout(() => fired++, 100, true);

		now += 50;
		timeout.pause();
		now += 1000;
		timeout.resume();

		expect(timeout.elapsedTime).toBe(50);

		Timer.runAll(now);
		expect(fired).toBe(0);

		now += 50;
		Timer.runAll(now);
		expect(fired).toBe(1);
	});

	test("elapsed and remaining time stay put while paused", () => {
		const timeout = new Timeout(() => {}, 100, true);

		now += 30;
		timeout.pause();
		now += 500;

		expect(timeout.elapsedTime).toBe(30);
		expect(timeout.remainingTime).toBe(70);
	});

	test("active is false while paused, after clearing, and once a timeout fired", () => {
		const paused = new Timeout(() => {}, 100, true);
		const cleared = new Timeout(() => {}, 100, true);
		const fired = new Timeout(() => {}, 100, true);
		const interval = new Interval(() => {}, 100, true);

		paused.pause();
		cleared.clear();
		now += 100;
		Timer.runAll(now);

		expect(paused.active).toBe(false);
		expect(cleared.active).toBe(false);
		expect(fired.active).toBe(false);
		expect(interval.active).toBe(true);

		paused.resume();
		expect(paused.active).toBe(true);
	});

	test("an interval fires once per period", () => {
		let fired = 0;

		new Interval(() => fired++, 100, true);

		for (let i = 0; i < 5; i++) {
			now += 100;
			Timer.runAll(now);
		}

		expect(fired).toBe(5);
	});

	test("a timer on the browser's clock resumes with what remained", async () => {
		const calls: number[] = [];
		const timeout = new Timeout(() => calls.push(1), 40);

		timeout.pause();
		now += 30;
		timeout.resume();

		expect(timeout.remainingTime).toBe(40);
		expect(timeout.active).toBe(true);

		await Bun.sleep(80);
		expect(calls).toEqual([1]);
		expect(timeout.active).toBe(false);
	});
});

describe("colours", () => {
	test("extractRGBA reads long hex, short hex and rgba()", () => {
		expect(extractRGBA("#ff8000")).toEqual({ r: 255, g: 128, b: 0, a: 1 });
		expect(extractRGBA("#f80")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
		expect(extractRGBA("rgba(1, 2, 3, 0.5)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
	});
});
