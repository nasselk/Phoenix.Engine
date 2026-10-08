import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { getOppositeAngle, normalizeAnglePI } from "../shared/math/angle";
import { InterpolationCurve, Interpolator } from "../shared/math/interpolation";
import { Quaternion } from "../shared/math/quaternion";
import { randomBoolean, randomElement, weightedRandom } from "../shared/math/random";
import { Vector3 } from "../shared/math/vector3";
import { extractRGBA } from "../shared/utils/color";
import { Interval, Timeout, Timer } from "../shared/utils/timers/timer";

describe("timers", () => {
	let now = 0;

	beforeEach(() => {
		now = 1000;
		spyOn(performance, "now").mockImplementation(() => now);
	});

	afterEach(() => {
		Timer.clear();
		mock.restore();
	});

	test("paused time never counts toward a timer", () => {
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

	test("elapsed time stays put while paused", () => {
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

	test("a timer driven by the browser's clock resumes with what remained", async () => {
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

describe("Vector3", () => {
	test("delta is this minus the other", () => {
		expect(new Vector3(3, 4, 5).delta(new Vector3(1, 2, 3)).xyz).toEqual([2, 2, 2]);
	});

	test("project onto a direction leaves both vectors alone", () => {
		const direction = new Vector3(5, 0, 0);
		const point = new Vector3(2, 3, 0);

		expect(point.project(direction).xyz).toEqual([2, 0, 0]);
		expect(direction.xyz).toEqual([5, 0, 0]);
		expect(point.xyz).toEqual([2, 3, 0]);
	});

	test("projectOnSegment clamps to the endpoints and segmentDistance measures to it", () => {
		const a = new Vector3(0, 0, 0);
		const b = new Vector3(10, 0, 0);

		expect(new Vector3(4, 3, 0).projectOnSegment(a, b).xyz).toEqual([4, 0, 0]);
		expect(new Vector3(-5, 0, 0).projectOnSegment(a, b).xyz).toEqual([0, 0, 0]);
		expect(new Vector3(4, 3, 0).segmentDistance(a, b)).toBe(3);
	});

	test("results go into the vector passed as out", () => {
		const out = new Vector3();

		expect(new Vector3(1, 0, 0).cross(new Vector3(0, 1, 0), out)).toBe(out);
		expect(out.xyz).toEqual([0, 0, 1]);
		expect(new Vector3(0, 0, 0).midpoint(new Vector3(4, 4, 4), out).xyz).toEqual([2, 2, 2]);
	});

	test("azimuth is the yaw that faces the vector, y-up", () => {
		const from = new Vector3(0, 0, 0);

		for (const yaw of [0, 0.5, Math.PI / 2, 2, -1]) {
			const direction = new Vector3(yaw, 0, 1, true);

			expect(direction.x).toBeCloseTo(Math.sin(yaw));
			expect(direction.y).toBeCloseTo(0);
			expect(direction.z).toBeCloseTo(Math.cos(yaw));
			expect(from.azimuthTo(direction)).toBeCloseTo(yaw);
			expect(new Quaternion().setFromYaw(direction.azimuth).yaw).toBeCloseTo(yaw);
		}
	});

	test("elevation is the angle above the ground, and setting it keeps the azimuth", () => {
		const up = new Vector3(0, Math.PI / 2, 5, true);

		expect(up.y).toBeCloseTo(5);
		expect(new Vector3(1, 1, 0).elevation).toBeCloseTo(Math.PI / 4);

		const vector = new Vector3(1, 0, 1);

		vector.elevation = Math.PI / 6;
		expect(vector.azimuth).toBeCloseTo(Math.PI / 4);
		expect(vector.elevation).toBeCloseTo(Math.PI / 6);
	});
});

describe("angles", () => {
	test("normalizeAnglePI wraps into [-π, π)", () => {
		expect(normalizeAnglePI(Math.PI)).toBeCloseTo(-Math.PI);
		expect(normalizeAnglePI(Math.PI / 2 + 2 * Math.PI)).toBeCloseTo(Math.PI / 2);
	});

	test("getOppositeAngle stays in [0, 2π) for negative angles", () => {
		expect(getOppositeAngle(-Math.PI / 2)).toBeCloseTo(Math.PI / 2);
		expect(getOppositeAngle(0)).toBeCloseTo(Math.PI);
	});
});

describe("colours", () => {
	test("extractRGBA reads hex as well as rgba()", () => {
		expect(extractRGBA("#ff8000")).toEqual({ r: 255, g: 128, b: 0, a: 1 });
		expect(extractRGBA("#f80")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
		expect(extractRGBA("rgba(1, 2, 3, 0.5)")).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
	});

	test("lerpColor and tweenColor work between hex colours", () => {
		expect(Interpolator.lerpColor("#000000", "#ffffff", 0.5)).toBe("rgba(128, 128, 128, 1)");
		expect(Interpolator.tweenColor("#000000", "#ff0000", 100, 50)).toBe("rgba(128, 0, 0, 1)");
	});
});

describe("random", () => {
	const sequence = (...values: number[]) => {
		let i = 0;

		return () => values[i++ % values.length]!;
	};

	test("weightedRandom picks by weight, with an injectable source", () => {
		expect(weightedRandom([1, 3], sequence(0.2))).toBe(0);
		expect(weightedRandom([1, 3], sequence(0.3))).toBe(1);
		expect(weightedRandom([0, 5, 0], sequence(0.99))).toBe(1);
	});

	test("weightedRandom refuses weights that cannot pick anything", () => {
		expect(() => weightedRandom([])).toThrow();
		expect(() => weightedRandom([0, 0])).toThrow();
		expect(() => weightedRandom([1, -1])).toThrow();
	});

	test("randomBoolean and randomElement take a seeded source", () => {
		expect(randomBoolean(1, 1, sequence(0.1))).toBe(true);
		expect(randomBoolean(1, 1, sequence(0.9))).toBe(false);
		expect(randomElement(["a", "b", "c"], sequence(0.5))).toBe("b");
	});
});

describe("tweens", () => {
	test("every curve starts at the start and ends at the end", () => {
		for (const curve of [InterpolationCurve.LINEAR, InterpolationCurve.EASE_IN, InterpolationCurve.EASE_OUT, InterpolationCurve.EASE_IN_OUT]) {
			expect(Interpolator.tween(10, 20, 100, 0, curve)).toBeCloseTo(10);
			expect(Interpolator.tween(10, 20, 100, 100, curve)).toBeCloseTo(20);
		}

		expect(Interpolator.tween(10, 20, 100, 50)).toBeCloseTo(15);
	});
});
