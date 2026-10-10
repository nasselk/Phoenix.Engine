import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import type { PositionEntity } from "../../server/src/world/entities/position";
import type { World } from "../../server/src/world/world";
import { initPhysics, RAPIER } from "../../shared/physics/rapier";
import { defineEntities } from "../../shared/world/registry";
import { Box, type BoxOptions, createRoom } from "../fixtures";

/** A box that writes down every touch it hears of, and with `vanish` is destroyed by its first, like a coin. With `sensor`, a fixed zone that things pass through; with `twoParts`, two colliders side by side. */
class Probe extends Box {
	public readonly log: string[] = [];
	private readonly vanish: boolean;

	public constructor(world: World<any, unknown>, context: unknown, options: BoxOptions & { sensor?: boolean; twoParts?: boolean; vanish?: boolean } = {}) {
		super(world, context, options);

		this.vanish = options.vanish ?? false;

		if (options.sensor || options.twoParts) {
			const [x, y, z] = options.halfSize ?? [0.5, 0.5, 0.5];
			const parts = options.twoParts ? [-x / 2, x / 2] : [0];

			this.embody(
				RAPIER.RigidBodyDesc.fixed(),
				...parts.map((offset) =>
					RAPIER.ColliderDesc.cuboid(options.twoParts ? x / 2 : x, y, z)
						.setTranslation(offset, 0, 0)
						.setSensor(options.sensor ?? false),
				),
			);
		}
	}

	public override onTouch(other: PositionEntity<any>): void {
		this.log.push(`touch ${other.kind}`);

		if (this.vanish) {
			this.destroy();
		}
	}

	public override onTouchEnd(other: PositionEntity<any>): void {
		this.log.push(`end ${other.kind}`);
	}
}

function createArena() {
	const room = createRoom(defineEntities({ box: Box, probe: Probe }));

	room.spawn("box", { y: -0.5, fixed: true, halfSize: [20, 0.5, 20] });

	return room;
}

function step(room: { update(deltaTime: number): void }, ticks: number): void {
	for (let i = 0; i < ticks; i++) {
		room.update(1 / 60);
	}
}

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

describe("MovingEntity", () => {
	test("its options set gravity on the body, and leave the body's own description alone when they say nothing", () => {
		const room = createRoom();
		const floating = room.spawn("box", { y: 5, floating: true });
		const falling = room.spawn("box", { x: 3, y: 5, floating: true, gravityScale: 1 });

		step(room, 30);

		expect(floating.position.y).toBe(5);
		expect(falling.position.y).toBeLessThan(5);
	});
});

describe("PositionEntity touches", () => {
	test("a solid contact starts a touch once, and moving apart ends it", () => {
		const room = createArena();
		const probe = room.spawn("probe", { y: 2 });

		step(room, 120);

		expect(probe.log).toEqual(["touch box"]);

		probe.teleport(0, 10, 0);
		step(room, 2);

		expect(probe.log).toEqual(["touch box", "end box"]);
	});

	test("a sensor hears what passes through it, and the other entity does not have to listen", () => {
		const room = createArena();
		const zone = room.spawn("probe", { y: 3, sensor: true, halfSize: [2, 0.5, 2] });
		const crate = room.spawn("box", { y: 6 });

		step(room, 120);

		expect(zone.log).toEqual(["touch box", "end box"]);
		expect(crate.position.y).toBeCloseTo(0.5, 1);
	});

	test("several colliders touching the same entity make one touch", () => {
		const room = createArena();
		const wide = room.spawn("probe", { y: 3, sensor: true, twoParts: true, halfSize: [2, 0.5, 2] });

		room.spawn("box", { y: 6, halfSize: [1.5, 0.5, 1.5] });
		step(room, 120);

		expect(wide.log).toEqual(["touch box", "end box"]);
	});

	test("destroying either side ends the touch on the other", () => {
		const room = createArena();
		const zone = room.spawn("probe", { y: 0.5, sensor: true });
		const crate = room.spawn("box", { y: 0.5 });

		step(room, 2);

		expect(zone.isTouching(crate)).toBe(true);

		crate.destroy();

		expect(zone.log).toEqual(["touch box", "end box"]);
		expect(zone.isTouching(crate)).toBe(false);

		step(room, 2);

		expect(zone.log).toEqual(["touch box", "end box"]);
	});

	test("an entity destroyed by its own touch leaves the other side with no touch open", () => {
		const room = createArena();
		const coin = room.spawn("probe", { y: 0.5, sensor: true, vanish: true });
		const picker = room.spawn("probe", { y: 0.5 });

		step(room, 3);

		expect(coin.alive).toBe(false);
		expect(coin.log).toEqual(["touch probe"]);
		expect(picker.isTouching(coin)).toBe(false);
		expect(picker.log.filter((line) => line === "touch probe").length).toBe(picker.log.filter((line) => line === "end probe").length);
	});
});
