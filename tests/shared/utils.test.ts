import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { extractRGBA } from "../../shared/utils/color";
import { IDAllocator } from "../../shared/utils/IDAllocator";
import { Interval, Timeout, Timer } from "../../shared/utils/timers/timer";
import { censorText } from "../../shared/utils/validation/text";

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

describe("censorText", () => {
	test("stars out a listed word standing on its own, whatever its case, keeping its length", () => {
		expect(censorText("ass")).toBe("***");
		expect(censorText("ASS hat")).toBe("*** hat");
		expect(censorText("Fück you")).toBe("**** you");
		expect(censorText("hello there")).toBe("hello there");
	});

	test("only whitespace, _, - and digits count as edges, so a word inside another is left alone", () => {
		expect(censorText("an ass_ass-ass1ass")).toBe("an ***_***-***1***");
		expect(censorText("class")).toBe("class");
		expect(censorText("fück!")).toBe("fück!");
	});
});

describe("IDAllocator", () => {
	test("a reserved id is never allocated while held, and the ids it skipped still are", () => {
		const ids = new IDAllocator();

		expect(ids.reserve(3)).toBe(true);
		expect(ids.reserve(3)).toBe(false);
		expect([ids.allocate(), ids.allocate(), ids.allocate()].sort((a, b) => a - b)).toEqual([1, 2, 4]);

		expect(ids.reserve(-2)).toBe(true);
		expect([ids.allocateNegative(), ids.allocateNegative()].sort((a, b) => a - b)).toEqual([-3, -1]);
	});

	test("an id in use, or not an id, cannot be reserved", () => {
		const ids = new IDAllocator();
		const taken = ids.allocate();

		expect(ids.reserve(taken)).toBe(false);
		expect(ids.reserve(0)).toBe(false);
		expect(ids.reserve(1.5)).toBe(false);

		ids.free(taken);
		expect(ids.reserve(taken)).toBe(true);
	});
});
