import { beforeAll, describe, expect, test } from "bun:test";
import { BufferReader } from "@nasselk/binarypack";
import { PositionEntity as ClientPositionEntity } from "../client/src/world/entities/position";
import { World as ClientWorld } from "../client/src/world/world";
import { MovingEntity } from "../server/src/world/entities/moving";
import { Seen } from "../server/src/world/replication";
import { World as ServerWorld } from "../server/src/world/world";
import { RAPIER, initPhysics } from "../shared/physics/rapier";
import { defineEntities } from "../shared/world/registry";

class ServerBox extends MovingEntity<undefined> {
	public constructor(world: ServerWorld<any, undefined>, context: undefined, options: { id?: number; x?: number; y?: number; z?: number; fixed?: boolean } = {}) {
		super(world, context, options);

		this.embody(options.fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic(), RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5));
	}
}

class ClientBox extends ClientPositionEntity<undefined> {
	public render(): void {}
}

type TestSocket = { id: number; room?: ServerWorld<any, undefined>; seen: Seen; subscribe(): void; unsubscribe(): void };

function createRooms() {
	const server = new ServerWorld({ inviteCode: "TEST", entities: defineEntities({ box: ServerBox }), context: undefined, network: {} as never });
	const client = new ClientWorld({ entities: defineEntities({ box: ClientBox }), context: undefined });
	const socket: TestSocket = { id: 1, seen: new Seen(), subscribe() {}, unsubscribe() {} };

	server.join(socket as never);

	return { server, client, socket };
}

/** Sends the socket its frame the way the game loop does, and applies it on the client. Returns whether one was sent. */
function send(server: ServerWorld<any, undefined>, client: ClientWorld<any, undefined>, socket: TestSocket, visible: Iterable<ServerBox> = server.entities.values() as Iterable<ServerBox>): boolean {
	const frame = server.frame(socket as never, visible);

	server.clean();

	if (frame === undefined) {
		return false;
	}

	const reader = new BufferReader(frame, true);

	reader.readUint8();
	client.sync(reader);

	return true;
}

beforeAll(async () => {
	await initPhysics();
});

describe("replication", () => {
	test("a spawn arrives with its kind, id and position", () => {
		const { server, client, socket } = createRooms();
		const box = server.spawn("box", { x: 1, y: 2, z: 3, fixed: true });

		expect(send(server, client, socket)).toBe(true);

		const copy = client.get(box.id, ClientBox);

		expect(copy?.kind).toBe("box");
		expect([copy!.position.x, copy!.position.y, copy!.position.z]).toEqual([1, 2, 3]);
	});

	test("a still world sends nothing after the first frame", () => {
		const { server, client, socket } = createRooms();

		server.spawn("box", { fixed: true });
		send(server, client, socket);
		server.update(1 / 60);

		expect(send(server, client, socket)).toBe(false);
	});

	test("movement arrives as an update", () => {
		const { server, client, socket } = createRooms();
		const box = server.spawn("box", { y: 5 });

		send(server, client, socket);

		for (let i = 0; i < 10; i++) {
			server.update(1 / 60);
		}

		expect(send(server, client, socket)).toBe(true);
		expect(client.get(box.id, ClientBox)!.targetPosition.y).toBeCloseTo(box.position.y, 5);
	});

	test("a destroyed entity despawns", () => {
		const { server, client, socket } = createRooms();
		const box = server.spawn("box", { fixed: true });

		send(server, client, socket);
		box.destroy();
		send(server, client, socket);

		expect(client.get(box.id)).toBeUndefined();
	});

	test("leaving view despawns, and coming back respawns", () => {
		const { server, client, socket } = createRooms();
		const box = server.spawn("box", { x: 4, fixed: true });

		send(server, client, socket);
		send(server, client, socket, []);

		expect(client.get(box.id)).toBeUndefined();

		send(server, client, socket);

		expect(client.get(box.id, ClientBox)?.position.x).toBe(4);
	});

	test("many entities fit one frame, with each one read back in place", () => {
		const { server, client, socket } = createRooms();
		const boxes = Array.from({ length: 300 }, (_, i) => server.spawn("box", { x: i, fixed: true }));

		send(server, client, socket);

		for (const box of boxes) {
			expect(client.get(box.id, ClientBox)?.position.x).toBe(box.position.x);
		}
	});

	test("two sockets each get the whole world", () => {
		const { server, client, socket } = createRooms();
		const other = { id: 2, seen: new Seen(), subscribe() {}, unsubscribe() {} };
		const second = new ClientWorld({ entities: defineEntities({ box: ClientBox }), context: undefined });

		server.join(other as never);

		const box = server.spawn("box", { x: 7, fixed: true });
		const first = server.frame(socket as never, server.entities.values())!.slice();
		const frame = server.frame(other as never, server.entities.values())!;

		server.clean();

		for (const [world, bytes] of [[client, first], [second, frame]] as const) {
			const reader = new BufferReader(bytes, true);

			reader.readUint8();
			world.sync(reader);
		}

		expect(client.get(box.id, ClientBox)?.position.x).toBe(7);
		expect(second.get(box.id, ClientBox)?.position.x).toBe(7);
	});
});
