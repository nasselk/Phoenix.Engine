import { BufferReader } from "@nasselk/binarypack";
import { PositionEntity as ClientPositionEntity } from "../client/src/world/entities/position";
import { World as ClientWorld } from "../client/src/world/world";
import { MovingEntity } from "../server/src/world/entities/moving";
import { Seen } from "../server/src/world/replication";
import { World as ServerWorld } from "../server/src/world/world";
import { RAPIER } from "../shared/physics/rapier";
import { defineEntities, type EntityDefinitions, type EntityRegistry } from "../shared/world/registry";

export type BoxOptions = { id?: number; x?: number; y?: number; z?: number; fixed?: boolean; upright?: boolean; floating?: boolean; gravityScale?: number; halfSize?: [number, number, number] };

/** A cube with a body: dynamic unless `fixed`, unable to tip when `upright`, described with no gravity when `floating`. Call `initPhysics` before spawning one. `settled` is whether its body sleeps. */
export class Box extends MovingEntity<unknown> {
	public constructor(world: ServerWorld<any, unknown>, context: unknown, options: BoxOptions = {}) {
		super(world, context, options);

		const body = options.fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
		const [x, y, z] = options.halfSize ?? [0.5, 0.5, 0.5];

		if (options.upright) {
			body.lockRotations();
		}

		if (options.floating) {
			body.setGravityScale(0);
		}

		this.embody(body, RAPIER.ColliderDesc.cuboid(x, y, z));
	}

	public get settled(): boolean {
		return this.body!.isSleeping();
	}
}

export class ClientBox extends ClientPositionEntity<undefined> {
	public render(): void {}
}

export type TestSocket = { id: number; room?: ServerWorld<any, unknown>; seen: Seen; subscribe(): void; unsubscribe(): void };

let nextSocket = 1;

/** Stands in for a connected socket: what a room needs to seat it and replicate to it. */
export function createSocket(): TestSocket {
	return { id: nextSocket++, seen: new Seen(), subscribe() {}, unsubscribe() {} };
}

/** A room on its own, with no engine or network around it. */
export function createRoom<D extends EntityDefinitions = { box: typeof Box }>(entities: EntityRegistry<D> = defineEntities({ box: Box }) as never): ServerWorld<D, unknown> {
	return new ServerWorld({ inviteCode: "TEST", entities, context: undefined, network: {} as never });
}

export function createMirror<D extends EntityDefinitions = { box: typeof ClientBox }>(entities: EntityRegistry<D> = defineEntities({ box: ClientBox }) as never): ClientWorld<D, undefined> {
	return new ClientWorld({ entities, context: undefined });
}

/** Applies a frame from `room.frame` to a client world, skipping the event code the network would have read. */
export function deliver(frame: Uint8Array, client: ClientWorld<any, undefined>): void {
	const reader = new BufferReader(frame, true);

	reader.readUint8();
	client.sync(reader);
}

/** Sends the socket its frame the way the game loop does, and applies it on the client. Returns whether one was sent. */
export function replicate(room: ServerWorld<any, unknown>, client: ClientWorld<any, undefined>, socket: TestSocket, visible: Iterable<Box> = room.entities.values() as Iterable<Box>): boolean {
	const frame = room.frame(socket as never, visible);

	room.clean();

	if (frame === undefined) {
		return false;
	}

	deliver(frame, client);

	return true;
}
