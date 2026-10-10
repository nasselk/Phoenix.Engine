import { beforeAll, describe, expect, test } from "bun:test";
import { Interpolator } from "../../shared/math/interpolation";
import { Quaternion } from "../../shared/math/quaternion";
import { initPhysics } from "../../shared/physics/rapier";
import { defineEntities } from "../../shared/world/registry";
import { ClientBox, createMirror, createRoom, createSocket, replicate } from "../fixtures";

/** A box shown halfway between where it is shown and where the server says it is, and never turned. */
class HalfwayBox extends ClientBox {
	protected override updatePosition(): void {
		Interpolator.lerpVector(this.position, this.targetPosition, 0.5);
	}

	protected override updateRotation(): void {}
}

function setup<K extends typeof ClientBox>(Kind: K) {
	const room = createRoom();
	const client = createMirror(defineEntities({ box: Kind }));
	const socket = createSocket();

	room.join(socket as never);

	const box = room.spawn("box", { y: 4, fixed: true });

	replicate(room, client, socket);

	return { room, client, socket, box, copy: client.get(box.id, Kind)! };
}

beforeAll(async () => {
	await initPhysics();
});

describe("PositionEntity", () => {
	test("by default it is shown where the server last said, from the next frame", () => {
		const { room, client, socket, box, copy } = setup(ClientBox);

		box.body!.setTranslation({ x: 2, y: 4, z: 0 }, false);
		box.body!.setRotation(new Quaternion().setFromEuler(0, 1, 0), false);
		room.update(1 / 60);
		replicate(room, client, socket);
		client.update(1 / 60);

		expect(copy.position.x).toBe(copy.targetPosition.x);
		expect(copy.rotation.angleTo(copy.targetRotation)).toBe(0);
		expect(copy.group.position.x).toBe(copy.targetPosition.x);
	});

	test("updatePosition and updateRotation decide what is shown, and the group follows it", () => {
		const { room, client, socket, box, copy } = setup(HalfwayBox);

		box.body!.setTranslation({ x: 2, y: 4, z: 0 }, false);
		box.body!.setRotation(new Quaternion().setFromEuler(0, 1, 0), false);
		room.update(1 / 60);
		replicate(room, client, socket);
		client.update(1 / 60);

		expect(copy.position.x).toBeCloseTo(1, 5);
		expect(copy.rotation.angleTo(copy.targetRotation)).toBeGreaterThan(0.9);
		expect(copy.group.position.x).toBeCloseTo(1, 5);
	});
});
