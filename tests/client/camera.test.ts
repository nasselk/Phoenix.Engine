import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { DesktopCamera } from "../../client/src/rendering/lib/camera/DesktopCamera";

/** The horizontal field of view a camera shows, in degrees. */
function horizontal(camera: DesktopCamera): number {
	return 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) * (180 / Math.PI);
}

describe("Camera", () => {
	test("keeps its vertical field of view on a wide screen", () => {
		const camera = new DesktopCamera().fit(16 / 9);

		expect(camera.fov).toBe(75);
		expect(horizontal(camera)).toBeGreaterThan(100);
	});

	test("widens on a narrow screen to keep minHorizontalFov across", () => {
		const camera = new DesktopCamera().fit(9 / 16);

		expect(horizontal(camera)).toBeCloseTo(60, 5);
		expect(camera.fov).toBeGreaterThan(75);
	});

	test("minHorizontalFov is off at 0, and either field of view applies as soon as it is set", () => {
		const camera = new DesktopCamera({ minHorizontalFov: 0 }).fit(9 / 16);

		expect(camera.fov).toBe(75);

		camera.minHorizontalFov = 70;
		expect(horizontal(camera)).toBeCloseTo(70, 5);

		camera.verticalFov = 120;
		expect(camera.fov).toBe(120);
	});

	test("turn swings it around its target at turnSpeed, the same way as a sideways drag", () => {
		const camera = new DesktopCamera({ yaw: 0, turnSpeed: 2 });

		camera.target = { x: 0, y: 0, z: 0 };
		camera.turn = 1;

		for (let frame = 0; frame < 60; frame++) {
			camera.update(1 / 60);
		}

		expect(camera.yaw).toBeCloseTo(-2, 5);

		const dragged = new DesktopCamera({ yaw: 0 });

		(dragged as unknown as { drag(x: number, y: number): void }).drag(10, 0);

		expect(Math.sign(dragged.yaw)).toBe(Math.sign(camera.yaw));
	});

	test("stays put with turn at 0, and with no target to turn around", () => {
		const still = new DesktopCamera({ yaw: 0.5 });

		still.target = { x: 0, y: 0, z: 0 };
		still.update(1);

		const untargeted = new DesktopCamera({ yaw: 0.5 });

		untargeted.turn = 1;
		untargeted.update(1);

		expect(still.yaw).toBe(0.5);
		expect(untargeted.yaw).toBe(0.5);
	});

	test("tilt raises and lowers it at tiltSpeed, within minPitch and maxPitch", () => {
		const camera = new DesktopCamera({ pitch: 0.6, tiltSpeed: 0.5, minPitch: 0.1, maxPitch: 1.4 });

		camera.target = { x: 0, y: 0, z: 0 };
		camera.tilt = -1;
		camera.update(0.1);

		expect(camera.pitch).toBeCloseTo(0.65, 5);

		for (let frame = 0; frame < 100; frame++) {
			camera.update(0.1);
		}

		expect(camera.pitch).toBe(1.4);

		camera.tilt = 1;

		for (let frame = 0; frame < 100; frame++) {
			camera.update(0.1);
		}

		expect(camera.pitch).toBe(0.1);
	});

	test("detached, it flies where it looks at flySpeed, boost times faster while boosting", () => {
		const camera = new DesktopCamera({ flySpeed: 10, boost: 3 });

		camera.target = { x: 0, y: 0, z: 0 };
		camera.update();
		camera.detached = true;

		const start = camera.position.clone();
		const forward = camera.getWorldDirection(new Vector3());

		camera.flyForward = 1;
		camera.update(0.05);

		expect(camera.position.clone().sub(start).toArray().map((value) => value / 0.5)).toEqual(forward.toArray().map((value) => expect.closeTo(value, 5)));

		const before = camera.position.clone();

		camera.flyBoost = true;
		camera.update(0.05);

		expect(camera.position.distanceTo(before)).toBeCloseTo(1.5, 5);
	});

	test("attached again, it orbits its target where it was before detaching", () => {
		const camera = new DesktopCamera({ flySpeed: 10 });

		camera.target = { x: 0, y: 0, z: 0 };
		camera.update();

		const orbit = camera.position.clone();

		camera.detached = true;
		camera.flyForward = 1;
		camera.update(0.05);
		camera.detached = false;
		camera.update(0.05);

		expect(camera.position.distanceTo(orbit)).toBeCloseTo(0, 5);
	});
});
