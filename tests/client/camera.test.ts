import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import { Camera, type CameraOptions } from "../../client/src/rendering/lib/camera/Camera";

/** The horizontal field of view a camera shows, in degrees. */
function horizontal(camera: Camera): number {
	return 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) * (180 / Math.PI);
}

type Handlers = Record<"onPointerDown" | "onPointerMove" | "onPointerUp", (event: object) => void> & { onWheel(event: object): void };

function handlers(camera: Camera): Handlers {
	return camera as unknown as Handlers;
}

/** A mouse drag of so many pixels with that button held. */
function mouseDrag(camera: Camera, button: number, x: number, y: number): void {
	const events = handlers(camera);

	events.onPointerDown({ pointerType: "mouse", button, pointerId: 1 });
	events.onPointerMove({ pointerType: "mouse", pointerId: 1, movementX: x, movementY: y });
	events.onPointerUp({ pointerType: "mouse", pointerId: 1 });
}

/** Fingers put down at their first points, moved to their second, then lifted. */
function fingers(camera: Camera, ...paths: [number, number, number, number][]): void {
	const events = handlers(camera);

	paths.forEach(([x, y], index) => events.onPointerDown({ pointerType: "touch", pointerId: 10 + index, clientX: x, clientY: y, currentTarget: null }));
	paths.forEach(([, , x, y], index) => events.onPointerMove({ pointerType: "touch", pointerId: 10 + index, clientX: x, clientY: y }));
	paths.forEach((_, index) => events.onPointerUp({ pointerType: "touch", pointerId: 10 + index }));
}

/** The editor's setup. */
function flying(options: CameraOptions = {}): Camera {
	return new Camera({ turnsAbout: "eye", zoomMode: "lens", panning: true, turnButton: 2, panButton: 0, minPitch: -Math.PI / 2, maxPitch: Math.PI / 2, ...options });
}

describe("Camera", () => {
	test("keeps its vertical field of view on a wide screen", () => {
		const camera = new Camera().fit(16 / 9);

		expect(camera.fov).toBe(75);
		expect(horizontal(camera)).toBeGreaterThan(100);
	});

	test("widens on a narrow screen to keep minHorizontalFov across", () => {
		const camera = new Camera().fit(9 / 16);

		expect(horizontal(camera)).toBeCloseTo(60, 5);
		expect(camera.fov).toBeGreaterThan(75);
	});

	test("minHorizontalFov is off at 0, and either field of view applies as soon as it is set", () => {
		const camera = new Camera({ minHorizontalFov: 0 }).fit(9 / 16);

		expect(camera.fov).toBe(75);

		camera.minHorizontalFov = 70;
		expect(horizontal(camera)).toBeCloseTo(70, 5);

		camera.verticalFov = 120;
		expect(camera.fov).toBe(120);
	});

	test("sits distance from its anchor along its yaw and pitch, looking at it, and the anchor follows its target", () => {
		const camera = new Camera({ yaw: 0.4, pitch: 0.6, distance: 10 });
		const player = new Vector3(3, 1, -2);

		camera.target = player;
		camera.update();

		expect(camera.anchor.toArray()).toEqual(player.toArray());
		expect(camera.position.distanceTo(player)).toBeCloseTo(10, 5);

		const toPlayer = player.clone().sub(camera.position).normalize();

		expect(camera.getWorldDirection(new Vector3()).dot(toPlayer)).toBeCloseTo(1, 5);

		player.x += 5;
		camera.update(1 / 60);

		expect(camera.anchor.x).toBe(8);
	});

	test("turn swings it around its anchor at turnSpeed, the same way as a sideways drag", () => {
		const camera = new Camera({ yaw: 0, turnSpeed: 2 });

		camera.turn = 1;

		for (let frame = 0; frame < 60; frame++) {
			camera.update(1 / 60);
		}

		expect(camera.yaw).toBeCloseTo(-2, 5);
		expect(camera.position.distanceTo(camera.anchor)).toBeCloseTo(camera.distance, 5);

		const dragged = new Camera({ yaw: 0 });

		mouseDrag(dragged, 0, 10, 0);

		expect(Math.sign(dragged.yaw)).toBe(Math.sign(camera.yaw));

		const still = new Camera({ yaw: 0.5 });

		still.update(1);

		expect(still.yaw).toBe(0.5);
	});

	test("tilt raises and lowers it at tiltSpeed, within minPitch and maxPitch", () => {
		const camera = new Camera({ pitch: 0.6, tiltSpeed: 0.5, minPitch: 0.1, maxPitch: 1.4 });

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

	test("a mouse and a finger both turn the same camera, a finger touchRotateScale times as far", () => {
		const mouse = new Camera({ yaw: 0, rotateSpeed: 0.01 });
		const finger = new Camera({ yaw: 0, rotateSpeed: 0.01, touchRotateScale: 2 });

		mouseDrag(mouse, 0, 10, 0);
		fingers(finger, [100, 100, 110, 100]);

		expect(mouse.yaw).toBeCloseTo(-0.1, 5);
		expect(finger.yaw).toBeCloseTo(-0.2, 5);

		mouseDrag(mouse, 2, 10, 0);

		expect(mouse.yaw).toBeCloseTo(-0.1, 5);
		expect(mouse.isOrbiting).toBe(false);
	});

	test("the wheel and a pinch zoom it: its distance by default, its lens with zoomMode lens", () => {
		const camera = new Camera({ distance: 10 });

		handlers(camera).onWheel({ deltaY: 100 });

		expect(camera.distance).toBeCloseTo(10 * Math.exp(0.1), 5);

		fingers(camera, [0, 0, -50, 0], [100, 0, 150, 0]);

		expect(camera.distance).toBeCloseTo(10 * Math.exp(0.1) * (100 / 200), 5);
		expect(camera.zoom).toBe(1);

		const lens = new Camera({ distance: 10, zoomMode: "lens" });

		fingers(lens, [0, 0, -50, 0], [100, 0, 150, 0]);

		expect(lens.zoom).toBeCloseTo(2, 5);
		expect(lens.distance).toBe(10);
	});

	test("lookFrom swings round its anchor over so many seconds, within its pitch limits, and a drag stops it", () => {
		const camera = new Camera({ yaw: 0, pitch: 0.6, maxPitch: 1.4 });

		camera.lookFrom({ x: 1, y: 0, z: 0 }, 0.25);
		camera.update(0.1);

		expect(camera.yaw).toBeGreaterThan(0);
		expect(camera.yaw).toBeLessThan(Math.PI / 2);

		camera.update(0.1);
		camera.update(0.1);

		expect(camera.yaw).toBeCloseTo(Math.PI / 2, 5);
		expect(camera.pitch).toBe(camera.minPitch);

		camera.lookFrom({ x: 0, y: 1, z: 0 }, 0.25);
		camera.update(0.05);
		mouseDrag(camera, 0, 0, 0);

		const stopped = camera.pitch;

		camera.update(0.2);

		expect(camera.pitch).toBe(stopped);
		expect(stopped).toBeLessThan(1.4);
	});

	test("orbit and lookFrom turn it around its anchor, which stays put, as far as straight down when its limits allow", () => {
		const camera = flying({ distance: 10 });

		camera.anchor.set(0, 2, 0);
		camera.orbit(0.7, 0.3);

		expect(camera.anchor.toArray()).toEqual([0, 2, 0]);
		expect(camera.position.distanceTo(camera.anchor)).toBeCloseTo(10, 5);

		camera.lookFrom({ x: 0, y: 1, z: 0 }, 0.25);
		camera.update(0.1);
		camera.update(0.1);
		camera.update(0.1);

		expect(camera.position.distanceTo(new Vector3(0, 12, 0))).toBeCloseTo(0, 4);
		expect(camera.getWorldDirection(new Vector3()).y).toBeCloseTo(-1, 5);
	});

	test("turning about its eye keeps it in place and swings the anchor round it", () => {
		const camera = flying({ yaw: 0, pitch: 0.2 });

		camera.update();

		const eye = camera.position.clone();
		const facing = camera.quaternion.clone();

		mouseDrag(camera, 2, 40, -20);

		expect(camera.position.distanceTo(eye)).toBeCloseTo(0, 5);
		expect(camera.quaternion.angleTo(facing)).toBeGreaterThan(0.01);
		expect(camera.anchor.clone().sub(camera.position).normalize().dot(camera.getWorldDirection(new Vector3()))).toBeCloseTo(1, 5);

		camera.target = { x: 0, y: 0, z: 0 };
		camera.update();
		mouseDrag(camera, 2, 40, 0);

		expect(camera.anchor.toArray()).toEqual([0, 0, 0]);
	});

	test("flies its anchor where it looks at flySpeed, boost times faster while boosting, and not while following a target", () => {
		const camera = new Camera({ flySpeed: 10, boost: 3, yaw: 0.8, pitch: 0.4 });

		camera.update();

		const start = camera.position.clone();
		const forward = camera.getWorldDirection(new Vector3());

		camera.flyForward = 1;
		camera.update(0.05);

		const moved = camera.position.clone().sub(start);

		expect(moved.length()).toBeCloseTo(0.5, 5);
		expect(moved.normalize().dot(forward)).toBeCloseTo(1, 5);

		const before = camera.position.clone();

		camera.flyBoost = true;
		camera.update(0.05);

		expect(camera.position.distanceTo(before)).toBeCloseTo(1.5, 5);

		camera.target = { x: 0, y: 0, z: 0 };
		camera.update(0.05);

		const following = camera.position.clone();

		camera.update(0.05);

		expect(camera.position.toArray()).toEqual(following.toArray());
	});

	test("a pan slides it across its view at panSpeed per pixel without turning it, from panButton or two fingers", () => {
		const camera = flying({ panSpeed: 0.1, yaw: 0.8, pitch: 0.4 });

		camera.update();

		const start = camera.position.clone();
		const facing = camera.quaternion.clone();
		const right = new Vector3(1, 0, 0).applyQuaternion(facing);
		const up = new Vector3(0, 1, 0).applyQuaternion(facing);

		mouseDrag(camera, 0, 20, -10);

		const moved = camera.position.clone().sub(start);

		expect(moved.dot(right)).toBeCloseTo(-2, 5);
		expect(moved.dot(up)).toBeCloseTo(-1, 5);
		expect(camera.quaternion.angleTo(facing)).toBeCloseTo(0, 5);

		const slid = camera.position.clone();

		camera.zooming = false;
		fingers(camera, [0, 0, 20, 0], [100, 0, 120, 0]);

		expect(camera.position.clone().sub(slid).dot(right)).toBeCloseTo(-2, 5);
		expect(camera.zoom).toBe(1);

		const game = new Camera({ panSpeed: 0.1 });
		const anchor = game.anchor.clone();

		mouseDrag(game, 2, 20, 0);
		fingers(game, [0, 0, 20, 0], [100, 0, 120, 0]);

		expect(game.anchor.toArray()).toEqual(anchor.toArray());
	});

	test("starts from what another camera shows: its place, facing and lens", () => {
		const game = new Camera({ fov: 60 }).fit(2);

		game.target = { x: 3, y: 0, z: -2 };
		game.update();

		const editor = flying().setZoom(4).startFrom(game);

		expect(editor.position.distanceTo(game.position)).toBeCloseTo(0, 5);
		expect(editor.quaternion.angleTo(game.quaternion)).toBeCloseTo(0, 5);
		expect(editor.fov).toBe(60);
		expect(editor.aspect).toBe(2);
		expect(editor.zoom).toBe(1);

		const plain = new PerspectiveCamera(50, 1);

		plain.position.set(4, 5, 6);
		plain.lookAt(0, 1, 0);

		const copy = flying().startFrom(plain);

		expect(copy.position.distanceTo(plain.position)).toBeCloseTo(0, 5);
		expect(copy.quaternion.angleTo(plain.quaternion)).toBeCloseTo(0, 5);
	});

	test("keeps minHorizontalFov on a narrow screen, and starts from the game camera's own vertical field of view", () => {
		const game = new Camera({ fov: 60 }).fit(9 / 16);
		const editor = flying().startFrom(game);

		expect(editor.verticalFov).toBe(60);
		expect(editor.fov).toBeCloseTo(game.fov, 10);

		editor.fit(16 / 9);

		expect(editor.fov).toBe(60);
	});
});
