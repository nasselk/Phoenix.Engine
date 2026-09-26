import { beforeAll, describe, expect, test } from "bun:test";
import { Engine } from "../server/src/engine";
import { initPhysics } from "../shared/physics/rapier";
import { defineEntities } from "../shared/world/registry";

let nextSocket = 1;

function fill(room: { join(socket: never): boolean }, players: number): void {
	for (let i = 0; i < players; i++) {
		room.join({ id: nextSocket++, subscribe() {}, unsubscribe() {} } as never);
	}
}

function createEngine() {
	return new Engine({ entities: defineEntities({}) });
}

beforeAll(async () => {
	await initPhysics();
});

describe("rooms", () => {
	test("quick play picks the fullest room with a free seat", () => {
		const engine = createEngine();
		const full = engine.createRoom(4);
		const busy = engine.createRoom(4);
		const quiet = engine.createRoom(4);

		fill(full, 4);
		fill(busy, 3);
		fill(quiet, 1);

		expect(engine.fullestRoom()).toBe(busy);
	});

	test("quick play finds nothing when every room is full", () => {
		const engine = createEngine();

		expect(engine.fullestRoom()).toBeUndefined();

		fill(engine.createRoom(2), 2);

		expect(engine.fullestRoom()).toBeUndefined();
	});

	test("occupancy reports players and seats per room", () => {
		const engine = createEngine();
		const room = engine.createRoom(6, undefined, "ABCDEF");

		fill(room, 2);

		expect(engine.occupancy()).toEqual({ ABCDEF: { players: 2, maxPlayers: 6 } });
	});
});
