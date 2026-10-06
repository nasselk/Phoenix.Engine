import { describe, expect, test } from "bun:test";
import { DesktopCamera } from "../client/src/rendering/lib/camera/DesktopCamera";

/** The horizontal field of view a camera shows, in degrees. */
function horizontal(camera: DesktopCamera): number {
	return 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) * (180 / Math.PI);
}

describe("camera field of view", () => {
	test("keeps the designed vertical field of view on a wide screen", () => {
		const camera = new DesktopCamera().fit(16 / 9);

		expect(camera.fov).toBe(75);
		expect(horizontal(camera)).toBeGreaterThan(100);
	});

	test("widens on a narrow screen until the horizontal field of view reaches its minimum", () => {
		const camera = new DesktopCamera().fit(9 / 16);

		expect(horizontal(camera)).toBeCloseTo(60, 5);
		expect(camera.fov).toBeGreaterThan(75);
	});

	test("is off at 0, and follows a change of either setting at once", () => {
		const camera = new DesktopCamera({ minHorizontalFov: 0 }).fit(9 / 16);

		expect(camera.fov).toBe(75);

		camera.minHorizontalFov = 70;
		expect(horizontal(camera)).toBeCloseTo(70, 5);

		camera.verticalFov = 120;
		expect(camera.fov).toBe(120);
	});
});

describe("camera turning", () => {
	test("turns around its target at turnSpeed, the way a sideways drag does, whatever the frame rate", () => {
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
});
