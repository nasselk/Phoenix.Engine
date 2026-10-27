import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { DesktopCamera } from "../../client/src/rendering/lib/camera/DesktopCamera";
import { EditorCamera } from "../../client/src/rendering/lib/editor/EditorCamera";

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
});

describe("EditorCamera", () => {
	test("starts from what another camera shows: its place, facing and lens", () => {
		const game = new DesktopCamera({ fov: 60 }).fit(2);

		game.target = { x: 3, y: 0, z: -2 };
		game.update();

		const editor = new EditorCamera().setZoom(4).startFrom(game);

		expect(editor.position.toArray()).toEqual(game.position.toArray());
		expect(editor.quaternion.angleTo(game.quaternion)).toBeCloseTo(0, 5);
		expect(editor.fov).toBe(60);
		expect(editor.aspect).toBe(2);
		expect(editor.zoom).toBe(1);
	});

	test("flies where it looks at flySpeed, boost times faster while boosting", () => {
		const camera = new EditorCamera({ flySpeed: 10, boost: 3 });

		camera.lookAt(1, -1, 2);

		const start = camera.position.clone();
		const forward = camera.getWorldDirection(new Vector3());

		camera.flyForward = 1;
		camera.update(0.05);

		expect(
			camera.position
				.clone()
				.sub(start)
				.toArray()
				.map((value) => value / 0.5),
		).toEqual(forward.toArray().map((value) => expect.closeTo(value, 5)));

		const before = camera.position.clone();

		camera.flyBoost = true;
		camera.update(0.05);

		expect(camera.position.distanceTo(before)).toBeCloseTo(1.5, 5);
	});

	test("a pan slides it across its view at panSpeed per pixel without turning it", () => {
		const camera = new EditorCamera({ panSpeed: 0.1 });

		camera.lookAt(1, -1, 2);

		const start = camera.position.clone();
		const facing = camera.quaternion.clone();
		const right = new Vector3(1, 0, 0).applyQuaternion(facing);
		const up = new Vector3(0, 1, 0).applyQuaternion(facing);

		(camera as unknown as { pan(x: number, y: number): void }).pan(20, -10);

		const moved = camera.position.clone().sub(start);

		expect(moved.dot(right)).toBeCloseTo(-2, 5);
		expect(moved.dot(up)).toBeCloseTo(-1, 5);
		expect(camera.quaternion.angleTo(facing)).toBeCloseTo(0, 5);
	});

	test("turns on the right mouse button and pans on the left", () => {
		const camera = new EditorCamera();
		const mouse = camera as unknown as Record<"onPointerDown" | "onPointerMove" | "onPointerUp", (event: object) => void>;
		const drag = (button: number) => {
			mouse.onPointerDown({ button, pointerId: 1 });
			mouse.onPointerMove({ pointerId: 1, movementX: 40, movementY: 0 });
			mouse.onPointerUp({ pointerId: 1 });
		};

		const position = camera.position.clone();
		const facing = camera.quaternion.clone();

		drag(2);
		expect(camera.quaternion.angleTo(facing)).toBeGreaterThan(0.01);
		expect(camera.position.toArray()).toEqual(position.toArray());

		const turned = camera.quaternion.clone();

		drag(0);
		expect(camera.position.distanceTo(position)).toBeGreaterThan(0.5);
		expect(camera.quaternion.angleTo(turned)).toBeCloseTo(0, 5);
	});
});
