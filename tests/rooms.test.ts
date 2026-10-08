import { beforeAll, describe, expect, test } from "bun:test";
import { Engine } from "../server/src/engine";
import { MovingEntity } from "../server/src/world/entities/moving";
import type { World } from "../server/src/world/world";
import { initPhysics, RAPIER } from "../shared/physics/rapier";
import { defineEntities } from "../shared/world/registry";

let nextSocket = 1;

function fill(room: { join(socket: never): boolean }, players: number): void {
	for (let i = 0; i < players; i++) {
		room.join({ id: nextSocket++, subscribe() {}, unsubscribe() {} } as never);
	}
}

class Crate extends MovingEntity<unknown> {
	public constructor(world: World<any, unknown>, context: unknown, options = {}) {
		super(world, context, options);

		this.embody(RAPIER.RigidBodyDesc.fixed(), RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5));
	}
}

/** Ends its own room from inside the room's tick, the way a referee ending a match would. */
class Referee extends Crate {
	public override update(deltaTime: number): void {
		(this.context as Engine<any, any>).destroyRoom(this.room.inviteCode);

		super.update(deltaTime);
	}
}

function createEngine() {
	return new Engine({ entities: defineEntities({ crate: Crate, referee: Referee }) });
}

beforeAll(async () => {
	await initPhysics();
});

describe("rooms", () => {
	test("quick play picks the fullest room with a free seat", () => {
		const engine = createEngine();
		const full = engine.createRoom({ maxPlayers: 4 });
		const busy = engine.createRoom({ maxPlayers: 4 });
		const quiet = engine.createRoom({ maxPlayers: 4 });

		fill(full, 4);
		fill(busy, 3);
		fill(quiet, 1);

		expect(engine.fullestRoom()).toBe(busy);
	});

	test("quick play finds nothing when every room is full", () => {
		const engine = createEngine();

		expect(engine.fullestRoom()).toBeUndefined();

		fill(engine.createRoom({ maxPlayers: 2 }), 2);

		expect(engine.fullestRoom()).toBeUndefined();
	});

	test("quick play skips private rooms, however full", () => {
		const engine = createEngine();
		const open = engine.createRoom({ maxPlayers: 4 });
		const invited = engine.createRoom({ maxPlayers: 4, public: false });

		fill(open, 1);
		fill(invited, 3);

		expect(engine.fullestRoom()).toBe(open);

		fill(open, 3);

		expect(engine.fullestRoom()).toBeUndefined();
	});

	test("quick play leaves out the invite codes it is told to", () => {
		const engine = createEngine();
		const busy = engine.createRoom({ maxPlayers: 4 });
		const quiet = engine.createRoom({ maxPlayers: 4 });

		fill(busy, 3);
		fill(quiet, 1);

		expect(engine.fullestRoom(busy.inviteCode)).toBe(quiet);
		expect(engine.fullestRoom(busy.inviteCode, quiet.inviteCode)).toBeUndefined();
	});

	test("occupancy reports players and seats per room", () => {
		const engine = createEngine();
		const room = engine.createRoom({ maxPlayers: 6, public: false, inviteCode: "ABCDEF" });

		fill(room, 2);

		expect(engine.occupancy()).toEqual({ ABCDEF: { players: 2, maxPlayers: 6, public: false } });
	});

	test("a room destroyed during its own tick finishes the tick, then is gone", () => {
		const engine = createEngine();
		const room = engine.createRoom();

		room.spawn("crate");
		room.spawn("referee");

		expect(() => room.update(1 / 60)).not.toThrow();
		expect(room.destroyed).toBe(true);
		expect(engine.getRoom(room.inviteCode)).toBeUndefined();
		expect(() => room.update(1 / 60)).not.toThrow();
	});

	test("a room destroyed directly is no longer found or offered", () => {
		const engine = createEngine();
		const room = engine.createRoom({ maxPlayers: 4 });

		expect(engine.fullestRoom()).toBe(room);

		room.destroy();

		expect(engine.getRoom(room.inviteCode)).toBeUndefined();
		expect(engine.fullestRoom()).toBeUndefined();
		expect(engine.occupancy()).toEqual({});
	});

	test("a spawn into a full room leaves no body behind", () => {
		const engine = createEngine();
		const room = engine.createRoom({ maxPlayers: 1, capacity: 1 });

		room.spawn("crate");

		expect(() => room.spawn("crate")).toThrow("World is full");
		expect(room.bodies.size).toBe(1);
		expect(room.physics.colliders.len()).toBe(1);
	});
});
