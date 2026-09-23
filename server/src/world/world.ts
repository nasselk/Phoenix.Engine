import type { EntityDefinitions } from "../../../shared/world/registry";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { OptionsOf, SpawnArguments } from "../../../shared/world/options";
import type { EntityOptions } from "../../../shared/world/entity";
import type { Contract, OutboundEvent, SendPayload } from "../../../shared/networking/protocol";
import type { NetworkSystem } from "../networking/NetworkSystem";
import { type Socket } from "../networking/socket";
import { GRAVITY } from "../../../shared/physics/constants";
import { RAPIER } from "../../../shared/physics/rapier";
import type { Entity } from "./entities/entity";
import type { PositionEntity } from "./entities/position";
import { Replication } from "./replication";

export type ServerWorldOptions<D extends EntityDefinitions, C, N extends Contract = Contract> = WorldOptions<D, C> & {
	readonly inviteCode: string;
	readonly network: NetworkSystem<any, any, any, any, N>;
};

export const MAX_SERVER_WORLD_SIZE = 2 ** 16 - 1; // 16 bits

/**
 * A room: a world with an invite code, and the sockets that joined it. `N` is the network's
 * contract, which is what types `broadcast`.
 */
export class World<D extends EntityDefinitions, C, N extends Contract = Contract> extends BaseWorld<D, C, Entity<C>> {
	/** What identifies this room: the code players join it by, and the topic its broadcasts go out on. */
	public readonly inviteCode: string;

	/** Everyone who joined, and so hears `broadcast`. */
	public readonly sockets = new Set<Socket<N>>();

	/**
	 * This room's physics: every body its entities were given, stepped once a tick. Its `gravity` pulls
	 * on every body, each as hard as its own `gravityScale` says.
	 */
	public readonly physics: RAPIER.World;

	/** The entities with a body, which are the ones a step moves. */
	public readonly bodies = new Set<PositionEntity<any>>();

	private readonly network: NetworkSystem<any, any, any, any, N>;

	private readonly replication: Replication;

	public constructor(options: ServerWorldOptions<D, C, N>) {
		super({ ...options, capacity: options.capacity ?? MAX_SERVER_WORLD_SIZE });

		if (this.capacity > MAX_SERVER_WORLD_SIZE) {
			throw new Error(`World capacity must be at most ${MAX_SERVER_WORLD_SIZE}, got ${this.capacity}`);
		}

		this.inviteCode = options.inviteCode;
		this.network = options.network;
		this.replication = new Replication(this.registry);
		this.physics = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
	}

	/**
	 * Positive ids, the ones that go on the wire. An id is a uint16 there, and ids held back for their
	 * reuse delay are not back in the pool yet, so recent deaths push the next id up too — past the
	 * limit it would wrap and alias another entity on every client, so this refuses instead.
	 */
	protected override allocateID(): number {
		const id = this.ids.allocate();

		if (id > MAX_SERVER_WORLD_SIZE) {
			this.ids.free(id);

			throw new Error(`World ran out of entity ids: ${this.size} alive and ${this.ids.pendingTimeouts} waiting out their reuse delay`);
		}

		return id;
	}

	/** Records written before this tick describe entities that are about to change. */
	public override update(deltaTime: number): void {
		this.replication.reset();

		super.update(deltaTime);
	}

	/** What code decided goes into the bodies, the physics steps, and where it put them comes back out. */
	protected override simulate(deltaTime: number): void {
		const { physics, bodies } = this;

		for (const entity of bodies) {
			if (entity.alive) {
				entity.beforePhysics();
			}
		}

		physics.timestep = deltaTime;
		physics.step();

		for (const entity of bodies) {
			if (entity.alive) {
				entity.afterPhysics();
			}
		}
	}

	/**
	 * The frame that brings a socket from what it was last sent to `visible`: what came into view
	 * spawns, what it already has and changed updates, and what left view or died despawns. Which
	 * entities are visible is the game's call; all of them is `room.entities.values()`.
	 *
	 * Each entity is encoded once however many frames it goes in. The frame is a view into a buffer
	 * the next call reuses, so send it right away. Undefined when there is nothing to tell.
	 */
	public frame(socket: Socket<N>, visible: Iterable<Entity<C>>): Uint8Array<ArrayBuffer> | undefined {
		if (socket.room !== this) {
			throw new Error(`Socket ${socket.id} is not in room ${this.inviteCode}`);
		}

		return this.replication.frame(socket.seen, visible);
	}

	/**
	 * Count every change so far as sent. Call it once every socket in the room got its frame: one left
	 * out would miss what changed and keep stale values.
	 */
	public clean(): void {
		for (const entity of this.entities.values()) {
			if (entity.alive && entity.isDirty) {
				entity.clean();
			}
		}

		this.replication.reset();
	}

	/**
	 * Start hearing this room's broadcasts, leaving whichever room the socket was in. Its first `frame`
	 * spawns everything it is shown.
	 */
	public join(socket: Socket<N>): this {
		if (socket.room === this) {
			return this;
		}

		socket.room?.leave(socket);

		this.sockets.add(socket);

		(socket as { room?: World<any, any, N> }).room = this;

		socket.subscribe(this.inviteCode);

		return this;
	}

	/** Stop hearing this room. A socket that is already disconnected has nothing left to unsubscribe. */
	public leave(socket: Socket<N>): boolean {
		if (!this.sockets.delete(socket)) {
			return false;
		}

		socket.seen.clear();

		(socket as { room?: World<any, any, N> }).room = undefined;

		socket.unsubscribe(this.inviteCode);

		return true;
	}

	/**
	 * Build an entity of a registered kind and put it in this world:
	 *
	 *   room.spawn("crate", { x: 4, z: -2, size: 2 });
	 *   room.spawn("floor");
	 *
	 * The options are that kind's own, typed from its constructor, and required only when it has a
	 * field it cannot default. `id` spawns under a specific id instead of an allocated one.
	 */
	public spawn<K extends Extract<keyof D, string>>(kind: K, ...args: SpawnArguments<D[K], 2>): InstanceType<D[K]> {
		const Kind = this.registry.class(kind);
		const options = (args[0] ?? {}) as OptionsOf<D[K], 2> & EntityOptions;

		const entity = new Kind(this, this.context, options) as InstanceType<D[K]>;

		return this.insert(kind, entity, options.id);
	}

	/** Send an event to every socket in this room. Encoded once, whoever is listening. */
	public broadcast<E extends OutboundEvent<N>>(event: E, ...data: SendPayload<N, E>): this {
		this.network.broadcast(this.inviteCode, event, ...data);

		return this;
	}

	public override destroy(): void {
		for (const socket of [...this.sockets]) {
			this.leave(socket);
		}

		super.destroy();

		this.replication.reset();

		// Every entity took its body out as it went; what is left is the world's own memory, outside JavaScript's.
		this.physics.free();
	}
}
