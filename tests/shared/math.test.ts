import { describe, expect, test } from "bun:test";
import { getOppositeAngle, normalizeAnglePI } from "../../shared/math/angle";
import { InterpolationCurve, Interpolator } from "../../shared/math/interpolation";
import { ObservableQuaternion, Quaternion } from "../../shared/math/quaternion";
import { randomBoolean, randomElement, weightedRandom } from "../../shared/math/random";
import { Vector3 } from "../../shared/math/vector3";

const DEGREE = Math.PI / 180;

function randomRotation(): Quaternion {
	return new Quaternion(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
}

/** A random source that returns these values in turn. */
function sequence(...values: number[]): () => number {
	let i = 0;

	return () => values[i++ % values.length]!;
}

describe("Vector3", () => {
	test("delta is this minus the other", () => {
		expect(new Vector3(3, 4, 5).delta(new Vector3(1, 2, 3)).xyz).toEqual([2, 2, 2]);
	});

	test("project returns a new vector and leaves both operands alone", () => {
		const direction = new Vector3(5, 0, 0);
		const point = new Vector3(2, 3, 0);

		expect(point.project(direction).xyz).toEqual([2, 0, 0]);
		expect(direction.xyz).toEqual([5, 0, 0]);
		expect(point.xyz).toEqual([2, 3, 0]);
	});

	test("projectOnSegment clamps to the endpoints, and segmentDistance measures to it", () => {
		const a = new Vector3(0, 0, 0);
		const b = new Vector3(10, 0, 0);

		expect(new Vector3(4, 3, 0).projectOnSegment(a, b).xyz).toEqual([4, 0, 0]);
		expect(new Vector3(-5, 0, 0).projectOnSegment(a, b).xyz).toEqual([0, 0, 0]);
		expect(new Vector3(4, 3, 0).segmentDistance(a, b)).toBe(3);
	});

	test("writes into the vector passed as out", () => {
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

describe("Quaternion", () => {
	test("packs into 4 bytes and unpacks within 0.25°", () => {
		const back = new Quaternion();

		for (let i = 0; i < 10000; i++) {
			const rotation = randomRotation();
			const packed = rotation.pack();

			expect(packed).toBeGreaterThanOrEqual(0);
			expect(packed).toBeLessThanOrEqual(0xffffffff);
			expect(back.unpack(packed).angleTo(rotation)).toBeLessThan(0.25 * DEGREE);
		}

		expect(back.unpack(new Quaternion(0, 0, 0, 1).pack()).angleTo(Quaternion.IDENTITY)).toBeLessThan(1e-6);
		expect(back.unpack(new Quaternion(0, 0, 0, -1).pack()).angleTo(Quaternion.IDENTITY)).toBeLessThan(1e-6);
	});

	test("converts to and from Euler angles", () => {
		const angles: [number, number, number] = [0.4, -2.1, 0.9];
		const euler = new Quaternion().setFromEuler(...angles).toEuler();

		for (let i = 0; i < 3; i++) {
			expect(euler[i]!).toBeCloseTo(angles[i]!, 6);
		}
	});

	test("reads back the yaw it was set to, and the yaw under a tilt", () => {
		expect(new Quaternion().setFromYaw(2.5).yaw).toBeCloseTo(2.5, 6);
		expect(new Quaternion().setFromEuler(0.3, -1.2, 0.2).yaw).toBeCloseTo(-1.2, 6);
	});

	test("treats q and -q as the same rotation, observed or not", () => {
		const rotation = randomRotation();
		const opposite = new Quaternion(-rotation.x, -rotation.y, -rotation.z, -rotation.w);

		expect(rotation.angleTo(opposite)).toBeLessThan(1e-6);

		const observed = new ObservableQuaternion().set(rotation).store();

		observed.set(opposite);

		expect(observed.hasUpdated(0.001)).toBe(false);
	});

	test("slerps the short way round, at a constant rate", () => {
		const from = new Quaternion().setFromYaw(0);
		const to = new Quaternion().setFromYaw(Math.PI / 2);
		const flipped = new Quaternion(-to.x, -to.y, -to.z, -to.w);

		expect(from.clone().slerp(to, 0.5).yaw).toBeCloseTo(Math.PI / 4, 6);
		expect(from.clone().slerp(flipped, 0.5).yaw).toBeCloseTo(Math.PI / 4, 6);
		expect(from.clone().slerp(to, 0.25).angleTo(from)).toBeCloseTo(Math.PI / 8, 6);
	});

	test("multiplies as composition, and invert undoes it", () => {
		const quarter = new Quaternion().setFromYaw(Math.PI / 2);

		expect(Math.abs(quarter.clone().multiply(quarter).yaw)).toBeCloseTo(Math.PI, 6);
		expect(quarter.clone().multiply(quarter.clone().invert()).angleTo(Quaternion.IDENTITY)).toBeLessThan(1e-6);
	});
});

describe("Interpolator", () => {
	test("every curve starts at the start and ends at the end", () => {
		for (const curve of [InterpolationCurve.LINEAR, InterpolationCurve.EASE_IN, InterpolationCurve.EASE_OUT, InterpolationCurve.EASE_IN_OUT]) {
			expect(Interpolator.tween(10, 20, 100, 0, curve)).toBeCloseTo(10);
			expect(Interpolator.tween(10, 20, 100, 100, curve)).toBeCloseTo(20);
		}

		expect(Interpolator.tween(10, 20, 100, 50)).toBeCloseTo(15);
	});

	test("lerpColor and tweenColor blend hex colours", () => {
		expect(Interpolator.lerpColor("#000000", "#ffffff", 0.5)).toBe("rgba(128, 128, 128, 1)");
		expect(Interpolator.tweenColor("#000000", "#ff0000", 100, 50)).toBe("rgba(128, 0, 0, 1)");
	});

	test("slerpQuaternion closes the gap every frame, along the shortest path, even where the Euler angles jump", () => {
		// 80° to 100° of pitch: as Euler angles the second is pitch 80°, yaw 180°, roll 180°.
		const rotation = new Quaternion().setFromEuler(80 * DEGREE, 0, 0);
		const target = new Quaternion().setFromEuler(100 * DEGREE, 0, 0);

		let left = rotation.angleTo(target);
		let turned = 0;

		for (let frame = 0; frame < 120; frame++) {
			const before = rotation.clone();

			Interpolator.slerpQuaternion(rotation, target, 0.25, 1, 0.0005);

			turned += before.angleTo(rotation);

			expect(rotation.angleTo(target)).toBeLessThanOrEqual(left + 1e-9);

			left = rotation.angleTo(target);
		}

		expect(left).toBe(0);
		expect(turned).toBeCloseTo(20 * DEGREE, 3);
	});
});

describe("angles", () => {
	test("normalizeAnglePI wraps into [-π, π)", () => {
		expect(normalizeAnglePI(Math.PI)).toBeCloseTo(-Math.PI);
		expect(normalizeAnglePI(Math.PI / 2 + 2 * Math.PI)).toBeCloseTo(Math.PI / 2);
	});

	test("getOppositeAngle stays in [0, 2π), negative angles included", () => {
		expect(getOppositeAngle(-Math.PI / 2)).toBeCloseTo(Math.PI / 2);
		expect(getOppositeAngle(0)).toBeCloseTo(Math.PI);
	});
});

describe("random", () => {
	test("weightedRandom picks by weight", () => {
		expect(weightedRandom([1, 3], sequence(0.2))).toBe(0);
		expect(weightedRandom([1, 3], sequence(0.3))).toBe(1);
		expect(weightedRandom([0, 5, 0], sequence(0.99))).toBe(1);
	});

	test("weightedRandom refuses weights that cannot pick anything", () => {
		expect(() => weightedRandom([])).toThrow();
		expect(() => weightedRandom([0, 0])).toThrow();
		expect(() => weightedRandom([1, -1])).toThrow();
	});

	test("randomBoolean and randomElement follow the source they are given", () => {
		expect(randomBoolean(1, 1, sequence(0.1))).toBe(true);
		expect(randomBoolean(1, 1, sequence(0.9))).toBe(false);
		expect(randomElement(["a", "b", "c"], sequence(0.5))).toBe("b");
	});
});
