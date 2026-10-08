import { beforeAll, describe, expect, test } from "bun:test";
import { Engine } from "../../server/src/engine";
import { initPhysics } from "../../shared/physics/rapier";
import { defineEntities } from "../../shared/world/registry";
import { Box, createSocket } from "../fixtures";

/** Ends its own room from inside the room's tick, the way a referee ending a match would. */
class Referee extends Box {
	public override update(deltaTime: number): void {
		(this.context as Engine<any, any>).destroyRoom(this.room.inviteCode);

		super.update(deltaTime);
	}
}

function createEngine() {
	return new Engine({ entities: defineEntities({ box: Box, referee: Referee }) });
}

function fill(room: { join(socket: never): boolean }, players: number): void {
	for (let i = 0; i < players; i++) {
		room.join(createSocket() as never);
	}
}

beforeAll(async () => {
	await initPhysics();
});

describe("Engine rooms", () => {
	test("fullestRoom picks the fullest public room with a free seat", () => {
		const engine = createEngine();
		const full = engine.createRoom({ maxPlayers: 4 });
		const busy = engine.createRoom({ maxPlayers: 4 });
		const quiet = engine.createRoom({ maxPlayers: 4 });
		const invited = engine.createRoom({ maxPlayers: 4, public: false });

		fill(full, 4);
		fill(busy, 3);
		fill(quiet, 1);
		fill(invited, 3);

		expect(engine.fullestRoom()).toBe(busy);
	});

	test("fullestRoom finds nothing when every public room is full", () => {
		const engine = createEngine();

		expect(engine.fullestRoom()).toBeUndefined();

		fill(engine.createRoom({ maxPlayers: 2 }), 2);
		engine.createRoom({ maxPlayers: 2, public: false });

		expect(engine.fullestRoom()).toBeUndefined();
	});

	test("fullestRoom leaves out the invite codes it is given", () => {
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

	test("a destroyed room is no longer found, offered or counted", () => {
		const engine = createEngine();
		const room = engine.createRoom({ maxPlayers: 4 });

		expect(engine.fullestRoom()).toBe(room);

		room.destroy();

		expect(engine.getRoom(room.inviteCode)).toBeUndefined();
		expect(engine.fullestRoom()).toBeUndefined();
		expect(engine.occupancy()).toEqual({});
	});

	test("a room destroyed during its own tick finishes the tick, then is gone", () => {
		const engine = createEngine();
		const room = engine.createRoom();

		room.spawn("box", { fixed: true });
		room.spawn("referee", { fixed: true });

		expect(() => room.update(1 / 60)).not.toThrow();
		expect(room.destroyed).toBe(true);
		expect(engine.getRoom(room.inviteCode)).toBeUndefined();
		expect(() => room.update(1 / 60)).not.toThrow();
	});

	test("a spawn into a full room throws and leaves no body behind", () => {
		const engine = createEngine();
		const room = engine.createRoom({ maxPlayers: 1, capacity: 1 });

		room.spawn("box", { fixed: true });

		expect(() => room.spawn("box", { fixed: true })).toThrow("World is full");
		expect(room.bodies.size).toBe(1);
		expect(room.physics.colliders.len()).toBe(1);
	});
});
