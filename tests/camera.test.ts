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
