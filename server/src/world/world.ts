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
import { RNG } from "../../../shared/math/random";

export type ServerWorldOptions<D extends EntityDefinitions, C, N extends Contract = Contract> = WorldOptions<D, C> & {
	readonly inviteCode: string;
	readonly maxPlayers?: number;
	readonly public?: boolean;
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

	public readonly RNG: RNG;

	/** Everyone who joined, and so hears `broadcast`. */
	public readonly sockets = new Set<Socket<N>>();

	/** The maximum number of players that can join this room. */
	public readonly maxPlayers: number;

	/** Whether quick play may put players in this room. A private one is joined only by its invite code. */
	public readonly public: boolean;
	/**
	 * This room's physics: every body its entities were given, stepped once a tick. Its `gravity` pulls
	 * on every body, each as hard as its own `gravityScale` says.
	 */
	public readonly physics: RAPIER.World;

	/** The entities with a body, which are the ones a step moves. */
	public readonly bodies = new Set<PositionEntity<any>>();

	/** Whether it was destroyed. A destroyed room never ticks again, and its engine lets go of it. */
	public destroyed = false;

	private readonly network: NetworkSystem<any, any, any, any, N>;

	private readonly replication: Replication;

	/** Where a step reports colliders starting and stopping to touch. Only colliders of entities that listen report. */
	private readonly events: RAPIER.EventQueue;

	private ticking = false;

	public constructor(options: ServerWorldOptions<D, C, N>) {
		super({ ...options, capacity: options.capacity ?? MAX_SERVER_WORLD_SIZE });
		this.maxPlayers = options.maxPlayers ?? this.capacity;

		if (this.capacity > MAX_SERVER_WORLD_SIZE) {
			throw new Error(`World capacity must be at most ${MAX_SERVER_WORLD_SIZE}, got ${this.capacity}`);
		}

		if (this.maxPlayers > this.capacity) {
			throw new Error(`World maxPlayers must be at most its capacity of ${this.capacity}, got ${this.maxPlayers}`);
		}

		this.inviteCode = options.inviteCode;
		this.public = options.public ?? true;
		this.network = options.network;
		this.replication = new Replication(this.registry);
		this.physics = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
		this.events = new RAPIER.EventQueue(true);
		this.RNG = new RNG(Math.floor(Math.random() * 2 ** 32));
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

	/**
	 * Start hearing this room's broadcasts, leaving whichever room the socket was in. Its first `frame`
	 * spawns everything it is shown.
	 */
	public join(socket: Socket<N>): boolean {
		if (socket.room === this) {
			return false;
		}

		if (this.sockets.size === this.maxPlayers) {
			return false;
		}

		socket.room?.leave(socket);

		this.sockets.add(socket);

		(socket as { room?: World<any, any, N> }).room = this;

		socket.subscribe(this.inviteCode);

		return true;
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

		if (this.size >= this.capacity) {
			throw new Error(`World is full (capacity ${this.capacity})`);
		}

		const entity = new Kind(this, this.context, options) as InstanceType<D[K]>;

		try {
			return this.insert(kind, entity, options.id);
		} catch (error) {
			entity.onDestroy();

			throw error;
		}
	}

	/** Records written before this tick describe entities that are about to change. */
	public override update(deltaTime: number): void {
		if (this.destroyed) {
			return;
		}

		this.replication.reset();
		this.ticking = true;

		try {
			super.update(deltaTime);
		} finally {
			this.ticking = false;

			if (this.destroyed) {
				this.freePhysics();
			}
		}
	}

	/** What code decided goes into the bodies, the physics steps, and where it put them comes back out. */
	protected override simulate(deltaTime: number): void {
		const { physics, bodies } = this;

		if (this.destroyed) {
			return;
		}

		for (const entity of bodies) {
			if (entity.alive) {
				entity.beforePhysics();
			}
		}

		physics.timestep = deltaTime;
		physics.step(this.events);

		for (const entity of bodies) {
			if (entity.alive) {
				entity.afterPhysics();
			}
		}

		this.events.drainCollisionEvents((first, second, started) => {
			const a = physics.getCollider(first)?.parent()?.userData as PositionEntity<any> | undefined;
			const b = physics.getCollider(second)?.parent()?.userData as PositionEntity<any> | undefined;

			if (a === undefined || b === undefined || a === b || !a.alive || !b.alive) {
				return;
			}

			a.touch(b, started);

			if (a.alive && b.alive) {
				b.touch(a, started);
			}
		});
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

		return this.replication.frame(socket.seen, visible, this.time);
	}

	/** Send an event to every socket in this room. Encoded once, whoever is listening. */
	public broadcast<E extends OutboundEvent<N>>(event: E, ...data: SendPayload<N, E>): this {
		this.network.broadcast(this.inviteCode, event, ...data);

		return this;
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

	/** Safe from inside its own tick: the physics is freed once the tick is over, and nothing else of it runs. */
	public override destroy(): void {
		if (this.destroyed) {
			return;
		}

		this.destroyed = true;

		for (const socket of [...this.sockets]) {
			this.leave(socket);
		}

		super.destroy();

		this.replication.reset();

		// Every entity took its body out as it went; what is left is the world's own memory, outside JavaScript's.
		if (!this.ticking) {
			this.freePhysics();
		}
	}

	private freePhysics(): void {
		this.physics.free();
		this.events.free();
	}

	/** Whether the world has available slots for new sockets. */
	public get hasAvailableSocketSlots(): boolean {
		return this.sockets.size < this.maxPlayers;
	}
}
