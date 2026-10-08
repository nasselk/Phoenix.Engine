import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { MovingEntity } from "../server/src/world/entities/moving";
import { World } from "../server/src/world/world";
import { RAPIER, initPhysics } from "../shared/physics/rapier";
import { defineEntities } from "../shared/world/registry";

type BoxOptions = { id?: number; x?: number; y?: number; z?: number; fixed?: boolean; upright?: boolean };

class Box extends MovingEntity<undefined> {
	public constructor(world: World<any, undefined>, context: undefined, options: BoxOptions = {}) {
		super(world, context, options);

		const body = options.fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();

		if (options.upright) {
			body.lockRotations();
		}

		this.embody(body, options.fixed ? RAPIER.ColliderDesc.cuboid(20, 0.5, 20) : RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5));
	}

	public get settled(): boolean {
		return this.body!.isSleeping();
	}
}

function createRoom() {
	const room = new World({ inviteCode: "TEST", entities: defineEntities({ box: Box }), context: undefined, network: {} as never });

	room.spawn("box", { y: -0.5, fixed: true });

	return room;
}

/** Steps the room until the box sleeps, or fails after ten simulated seconds. */
function settle(room: World<any, undefined>, box: Box): void {
	for (let i = 0; i < 600 && !box.settled; i++) {
		room.update(1 / 60);
	}

	expect(box.settled).toBe(true);
}

beforeAll(async () => {
	await initPhysics();
});

describe("bodies", () => {
	test("a falling box lands where the physics put it", () => {
		const room = createRoom();
		const box = room.spawn("box", { y: 3 }) as Box;

		settle(room, box);

		expect(box.position.y).toBeCloseTo(0.5, 2);
		expect(box.position.y).toBe(box.body!.translation().y);
	});

	test("a body asleep since the last step is not read again", () => {
		const room = createRoom();
		const box = room.spawn("box", { y: 3 }) as Box;

		settle(room, box);
		room.update(1 / 60);

		const reads = spyOn(box.body!, "translation");

		for (let i = 0; i < 10; i++) {
			room.update(1 / 60);
		}

		expect(reads).toHaveBeenCalledTimes(0);
	});

	test("a code-turned body is not touched while its rotation stays the same", () => {
		const room = createRoom();
		const box = room.spawn("box", { y: 3, upright: true }) as Box;

		room.update(1 / 60);

		const turns = spyOn(box.body!, "setRotation");

		for (let i = 0; i < 30; i++) {
			room.update(1 / 60);
		}

		expect(turns).toHaveBeenCalledTimes(0);
	});

	test("turning a sleeping, code-turned body wakes it and reaches the physics", () => {
		const room = createRoom();
		const box = room.spawn("box", { y: 3, upright: true }) as Box;

		settle(room, box);

		box.yaw = 1;
		room.update(1 / 60);

		const rotation = box.body!.rotation();

		expect(box.settled).toBe(false);
		expect(2 * Math.atan2(rotation.y, rotation.w)).toBeCloseTo(1, 5);
	});
});
