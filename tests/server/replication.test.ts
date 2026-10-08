import { beforeAll, describe, expect, test } from "bun:test";
import { Group } from "three";
import { Quaternion } from "../../shared/math/quaternion";
import { initPhysics } from "../../shared/physics/rapier";
import { defineEntities } from "../../shared/world/registry";
import { ClientBox, createMirror, createRoom, createSocket, deliver, replicate } from "../fixtures";

const QUARTER_DEGREE = (0.25 * Math.PI) / 180;

/** A box that moves something of its own along with its group, which only exists once its constructor has run. */
class ClientMarkedBox extends ClientBox {
	public readonly marker = new Group();

	protected override syncGroup(): void {
		super.syncGroup();

		this.marker.position.copy(this.group.position);
	}
}

/** A room, one socket seated in it, and the client world that mirrors it for that socket. */
function setup() {
	const room = createRoom();
	const client = createMirror();
	const socket = createSocket();

	room.join(socket as never);

	return { room, client, socket };
}

beforeAll(async () => {
	await initPhysics();
});

describe("replication", () => {
	test("a spawn arrives with its kind, id and position", () => {
		const { room, client, socket } = setup();
		const box = room.spawn("box", { x: 1, y: 2, z: 3, fixed: true });

		expect(replicate(room, client, socket)).toBe(true);

		const copy = client.get(box.id, ClientBox);

		expect(copy?.kind).toBe("box");
		expect([copy!.position.x, copy!.position.y, copy!.position.z]).toEqual([1, 2, 3]);
	});

	test("a spawn arrives turned the way it is", () => {
		const { room, client, socket } = setup();
		const box = room.spawn("box", { fixed: true });

		box.body!.setRotation(new Quaternion().setFromEuler(1.2, -2.5, 0.3), false);
		room.update(1 / 60);
		replicate(room, client, socket);

		expect(client.get(box.id, ClientBox)!.rotation.angleTo(box.rotation)).toBeLessThan(QUARTER_DEGREE);
	});

	test("a client kind's syncGroup can use its own fields on spawn", () => {
		const { room, socket } = setup();
		const client = createMirror(defineEntities({ box: ClientMarkedBox }));
		const box = room.spawn("box", { x: 1, y: 2, z: 3, fixed: true });

		replicate(room, client, socket);

		const copy = client.get(box.id, ClientMarkedBox)!;

		expect(copy.group.position.toArray()).toEqual([1, 2, 3]);
		expect(copy.marker.position.toArray()).toEqual([1, 2, 3]);
	});

	test("movement arrives as an update", () => {
		const { room, client, socket } = setup();
		const box = room.spawn("box", { y: 5 });

		replicate(room, client, socket);

		for (let i = 0; i < 10; i++) {
			room.update(1 / 60);
		}

		expect(replicate(room, client, socket)).toBe(true);
		expect(client.get(box.id, ClientBox)!.targetPosition.y).toBeCloseTo(box.position.y, 5);
	});

	test("a rotation arrives within 0.25°", () => {
		const { room, client, socket } = setup();
		const box = room.spawn("box", { fixed: true });

		replicate(room, client, socket);

		const turned = new Quaternion().setFromEuler(0.4, 1.1, -0.7);

		box.body!.setRotation(turned, false);
		room.update(1 / 60);
		replicate(room, client, socket);

		expect(client.get(box.id, ClientBox)!.targetRotation.angleTo(turned)).toBeLessThan(QUARTER_DEGREE);
	});

	test("a slow turn arrives, however small each tick's share of it", () => {
		const { room, client, socket } = setup();
		const box = room.spawn("box", { fixed: true });

		replicate(room, client, socket);

		const turned = new Quaternion();

		for (let tick = 1; tick <= 300; tick++) {
			box.body!.setTranslation({ x: tick * 0.01, y: 0, z: 0 }, false);
			box.body!.setRotation(turned.setFromYaw(tick * 0.005), false);
			room.update(1 / 60);
			replicate(room, client, socket);
		}

		expect(client.get(box.id, ClientBox)!.targetRotation.angleTo(box.rotation)).toBeLessThan(0.011);
	});

	test("a still world sends nothing after the first frame", () => {
		const { room, client, socket } = setup();

		room.spawn("box", { fixed: true });
		replicate(room, client, socket);
		room.update(1 / 60);

		expect(replicate(room, client, socket)).toBe(false);
	});

	test("a destroyed entity despawns", () => {
		const { room, client, socket } = setup();
		const box = room.spawn("box", { fixed: true });

		replicate(room, client, socket);
		box.destroy();
		replicate(room, client, socket);

		expect(client.get(box.id)).toBeUndefined();
	});

	test("leaving view despawns, and coming back respawns", () => {
		const { room, client, socket } = setup();
		const box = room.spawn("box", { x: 4, fixed: true });

		replicate(room, client, socket);
		replicate(room, client, socket, []);

		expect(client.get(box.id)).toBeUndefined();

		replicate(room, client, socket);

		expect(client.get(box.id, ClientBox)?.position.x).toBe(4);
	});

	test("a frame carries the room's time to the millisecond", () => {
		const { room, client, socket } = setup();

		room.spawn("box", { fixed: true });
		room.update(1 / 60);
		room.update(1 / 60);
		replicate(room, client, socket);

		expect(client.serverTime).toBeCloseTo(2 / 60, 3);
	});

	test("many entities fit one frame, each read back in place", () => {
		const { room, client, socket } = setup();
		const boxes = Array.from({ length: 300 }, (_, i) => room.spawn("box", { x: i, fixed: true }));

		replicate(room, client, socket);

		for (const box of boxes) {
			expect(client.get(box.id, ClientBox)?.position.x).toBe(box.position.x);
		}
	});

	test("each socket gets its own frame, encoded in the same tick", () => {
		const { room, client, socket } = setup();
		const other = createSocket();
		const second = createMirror();

		room.join(other as never);

		const box = room.spawn("box", { x: 7, fixed: true });
		const first = room.frame(socket as never, room.entities.values())!.slice();
		const frame = room.frame(other as never, room.entities.values())!;

		room.clean();
		deliver(first, client);
		deliver(frame, second);

		expect(client.get(box.id, ClientBox)?.position.x).toBe(7);
		expect(second.get(box.id, ClientBox)?.position.x).toBe(7);
	});
});
