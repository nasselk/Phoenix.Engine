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

	test("a room draws from its seed: the same seed, the same numbers; none, a random one", () => {
		const engine = createEngine();
		const draw = (room: ReturnType<typeof engine.createRoom>) => [room.RNG.random(), room.RNG.random(), room.RNG.random()];
		const first = draw(engine.createRoom({ seed: 42 }));

		expect(draw(engine.createRoom({ seed: 42 }))).toEqual(first);
		expect(draw(engine.createRoom())).not.toEqual(draw(engine.createRoom()));
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

describe("World join and leave", () => {
	test("emit join and leave once per socket that came in or went out: by leaving, by joining another room, or when the room is destroyed", () => {
		const engine = createEngine();
		const first = engine.createRoom({ maxPlayers: 4 });
		const second = engine.createRoom({ maxPlayers: 4 });
		const events: string[] = [];

		for (const [name, room] of [
			["first", first],
			["second", second],
		] as const) {
			room.on("join", () => events.push(`${name} join`));
			room.on("leave", () => events.push(`${name} leave`));
		}

		const socket = createSocket() as never;
		const other = createSocket() as never;

		first.join(socket);
		first.join(socket);
		second.join(socket);
		second.leave(socket);
		second.leave(socket);
		first.join(socket);
		first.join(other);
		engine.destroyRoom(first.inviteCode);

		expect(events).toEqual(["first join", "first leave", "second join", "second leave", "first join", "first join", "first leave", "first leave"]);
	});
});

describe("World spawn", () => {
	test("an entity spawns under a chosen id, which is then never allocated", () => {
		const room = createEngine().createRoom();
		const chosen = room.spawn("box", { id: 2 });
		const others = [room.spawn("box"), room.spawn("box")];

		expect(chosen.id).toBe(2);
		expect(others.map((box) => box.id)).not.toContain(2);
	});

	test("a chosen id that is taken, or does not fit on the wire, is refused", () => {
		const room = createEngine().createRoom();
		const box = room.spawn("box");

		expect(() => room.spawn("box", { id: box.id })).toThrow();
		expect(() => room.spawn("box", { id: 0 })).toThrow();
		expect(() => room.spawn("box", { id: 70000 })).toThrow();
		expect(room.get(box.id)).toBe(box);
	});
});
