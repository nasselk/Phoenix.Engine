import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { initPhysics } from "../../shared/physics/rapier";
import { type Box, createRoom } from "../fixtures";

/** A room with a floor whose top is at y = 0. */
function createFloor() {
	const room = createRoom();

	room.spawn("box", { y: -0.5, fixed: true, halfSize: [20, 0.5, 20] });

	return room;
}

/** Steps the room until the box sleeps, or fails after ten simulated seconds. */
function settle(room: ReturnType<typeof createFloor>, box: Box): void {
	for (let i = 0; i < 600 && !box.settled; i++) {
		room.update(1 / 60);
	}

	expect(box.settled).toBe(true);
}

beforeAll(async () => {
	await initPhysics();
});

describe("PositionEntity bodies", () => {
	test("an entity's position follows its body", () => {
		const room = createFloor();
		const box = room.spawn("box", { y: 3 });

		settle(room, box);

		expect(box.position.y).toBeCloseTo(0.5, 2);
		expect(box.position.y).toBe(box.body!.translation().y);
	});

	test("a sleeping body is not read", () => {
		const room = createFloor();
		const box = room.spawn("box", { y: 3 });

		settle(room, box);
		room.update(1 / 60);

		const reads = spyOn(box.body!, "translation");

		for (let i = 0; i < 10; i++) {
			room.update(1 / 60);
		}

		expect(reads).toHaveBeenCalledTimes(0);
	});

	test("a body turned by code is only written when its rotation changes", () => {
		const room = createFloor();
		const box = room.spawn("box", { y: 3, upright: true });

		room.update(1 / 60);

		const turns = spyOn(box.body!, "setRotation");

		for (let i = 0; i < 30; i++) {
			room.update(1 / 60);
		}

		expect(turns).toHaveBeenCalledTimes(0);
	});

	test("turning a sleeping body by code wakes it and reaches the physics", () => {
		const room = createFloor();
		const box = room.spawn("box", { y: 3, upright: true });

		settle(room, box);

		box.yaw = 1;
		room.update(1 / 60);

		const rotation = box.body!.rotation();

		expect(box.settled).toBe(false);
		expect(2 * Math.atan2(rotation.y, rotation.w)).toBeCloseTo(1, 5);
	});
});
