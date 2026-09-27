import { describe, expect, test } from "bun:test";
import { Interpolator } from "../shared/math/interpolation";
import { ObservableQuaternion, Quaternion } from "../shared/math/quaternion";

const DEGREE = Math.PI / 180;

function random(): Quaternion {
	return new Quaternion(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
}

describe("quaternion", () => {
	test("packs into 4 bytes and comes back within 0.25°", () => {
		const back = new Quaternion();

		for (let i = 0; i < 10000; i++) {
			const rotation = random();
			const packed = rotation.pack();

			expect(packed).toBeGreaterThanOrEqual(0);
			expect(packed).toBeLessThanOrEqual(0xffffffff);
			expect(back.unpack(packed).angleTo(rotation)).toBeLessThan(0.25 * DEGREE);
		}
	});

	test("packs the identity and its opposite sign as the same rotation", () => {
		const back = new Quaternion();

		expect(back.unpack(new Quaternion(0, 0, 0, 1).pack()).angleTo(Quaternion.IDENTITY)).toBeLessThan(1e-6);
		expect(back.unpack(new Quaternion(0, 0, 0, -1).pack()).angleTo(Quaternion.IDENTITY)).toBeLessThan(1e-6);
	});

	test("goes to and from Euler angles", () => {
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

	test("treats q and -q as the same rotation", () => {
		const rotation = random();
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

	test("composes: a quarter turn twice is a half turn", () => {
		const quarter = new Quaternion().setFromYaw(Math.PI / 2);

		expect(Math.abs(quarter.clone().multiply(quarter).yaw)).toBeCloseTo(Math.PI, 6);
		expect(quarter.clone().multiply(quarter.clone().invert()).angleTo(Quaternion.IDENTITY)).toBeLessThan(1e-6);
	});

	test("a crate tipping past its side turns straight there, instead of spinning", () => {
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
