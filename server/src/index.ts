import { IDAllocator } from "../../shared/utils/IDAllocator";
import { credit, log } from "../../shared/utils/logger";
import { GameLoop, type GameLoopParams } from "./GameLoop";
import { World } from "./world/world";
import { randomUUID } from "crypto";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import type { SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions, EntityRegistry } from "../../shared/world/registry";
import { EventEmitter } from "../../shared/utils/EventEmitter";

// The whole isomorphic surface, so a game that only has a server imports from one place.
export * from "../../shared/index";
// The server's own object model, exported over the shared one: an entity that can write itself and
// a world that can write a frame. `import { Entity } from "phoenix.engine/server"` is this one.
export { Entity } from "./world/entity";
export { MovingEntity, MIN_SPEED as STOP_SPEED } from "./world/moving";
export { BoxCollider, Collider, ColliderKind, collide, collideBoxBox, collideBoxPlane, DEFAULT_MASS, inverseMass, MIN_SLIDE, PlaneCollider, RESTITUTION_THRESHOLD, resolve, SLOP, type Collision, type ResolveOptions } from "./world/collision/index";
export { POSITION_EPSILON, PositionEntity, ROTATION_EPSILON, type PositionEntityOptions } from "./world/position";
export { World, type ServerWorldOptions } from "./world/world";
// Server-only pieces a game builds on.
export { GameLoop, type GameLoopParams } from "./GameLoop";
export { DEFAULT_NETWORK_SETTINGS, NetworkSystem, type EventLimit, type EventLimits, type NetworkSettings, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { Socket, SocketState, type SocketUserData } from "./networking/socket";
export { setExitListeners } from "./utils/utils";

type EngineEvents = {
	init: [];
	destroy: [];
};

/**
 * Ceiling on live entities in one room. It is a guard rail, not an allocation:
 * a world holds only the entities that exist, so this is what a runaway spawner
 * hits instead of the process running out of memory.
 */
export const DEFAULT_ROOM_CAPACITY = 5_000;

/** Everything the engine is handed: the room capacity, and optionally the networking to bring up with it. */
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, D extends EntityDefinitions = EntityDefinitions, C = unknown> = {
	readonly capacity?: number;
	readonly entities?: EntityRegistry<D>;
	/** What every entity in every room sees as `this.context`; left out, it is the engine. */
	readonly context?: C;
	readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
	readonly loop?: Partial<GameLoopParams>;
};

/**
 * One per process. Owns the room registry and the single timer that drives
 * every room.
 *
 * Rooms are not given their own GameLoop on purpose: N timers on one thread
 * drift independently and compete for the same event loop, where one loop
 * fanning out over the rooms ticks them in a deterministic order and gives you
 * one place to measure the whole process's tick budget.
 */
export class Engine<
	const In extends readonly string[] = [],
	const Out extends readonly string[] = [],
	const InSchemas extends SchemasFor<InSchemas, In> = {},
	const OutSchemas extends SchemasFor<OutSchemas, Out> = {},
	const D extends EntityDefinitions = EntityDefinitions,
	C = unknown,
> extends EventEmitter<EngineEvents> {
	public readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
	public readonly loop: GameLoop;
	public readonly rooms: Map<number, World<D, C>>;

	/**
	 * The game's entity kinds. Held here, next to `capacity`, because it is what every room this
	 * process opens is built with — not because the engine does anything with it.
	 *
	 * The registry itself lives on the World; this is only the default a room is stamped with. It
	 * belongs at this level for the same reason the event lists do: a kind's wire code is its place
	 * in one sorted list, so two rooms in a process cannot disagree about it without two clients
	 * decoding the same byte as different things. It is also where `D` comes from, which is what
	 * makes `rooms`, `getRoom` and `createRoom` all come back as this game's rooms rather than
	 * anonymous ones.
	 */
	private readonly entities?: EntityRegistry<D>;
	private readonly capacity: number;
	private readonly roomIDs: IDAllocator;
	private readonly roomsByInviteCode: Map<string, World<D, C>>;

	/** Handed to every room this engine opens. */
	private readonly context: C;

	public constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, D, C> = {}) {
		super();

		const capacity = options.capacity ?? DEFAULT_ROOM_CAPACITY;

		this.capacity = capacity;
		this.entities = options.entities;
		this.context = (options.context ?? this) as C;

		this.network = new NetworkSystem<In, Out, InSchemas, OutSchemas>(options.network);
		this.loop = new GameLoop(options.loop);
		this.rooms = new Map();
		this.roomIDs = new IDAllocator();
		this.roomsByInviteCode = new Map();
	}

	/**
	 * Open a match. Whatever it needs beyond entities — a sync loop, a round timer — is built by
	 * the caller against the room it just got, and listens for `room.on("update")`.
	 */
	public createRoom(inviteCode: string = randomUUID()): World<D, C> {
		if (this.roomsByInviteCode.has(inviteCode)) {
			throw new Error(`A room with invite code "${inviteCode}" already exists`);
		}

		const room = new World<D, C>({ id: this.roomIDs.allocate(), inviteCode, capacity: this.capacity, entities: this.entities, context: this.context });

		this.rooms.set(room.id, room);
		this.roomsByInviteCode.set(inviteCode, room);

		return room;
	}

	public getRoom(id: number): World<D, C> | undefined {
		return this.rooms.get(id);
	}

	public getRoomByInviteCode(inviteCode: string): World<D, C> | undefined {
		return this.roomsByInviteCode.get(inviteCode);
	}

	/** Tears the room down — every system's destroy() runs, every entity goes — and frees its id. */
	public destroyRoom(id: number): boolean {
		const room = this.rooms.get(id);

		if (room === undefined) {
			return false;
		}

		room.dispose();

		this.rooms.delete(id);
		this.roomsByInviteCode.delete(room.inviteCode);
		this.roomIDs.free(id);

		return true;
	}

	public async init(): Promise<void> {
		credit("Server");

		log("Phoenix Server", "Initializing the engine...");

		this.loop.on("tick", (deltaTime) => {
			for (const room of this.rooms.values()) {
				room.update(deltaTime);
			}
		});

		this.loop.resume();

		log("Phoenix Server", "Successfully initiated the engine");

		this.emit("init");
	}

	public destroy(): void {
		for (const id of [...this.rooms.keys()]) {
			this.destroyRoom(id);
		}

		this.network.destroy();
		this.loop.destroy();

		this.emit("destroy");

		this.removeAllListeners();
	}
}
