import { IDAllocator } from "../../shared/utils/IDAllocator";
import { credit, log } from "../../shared/utils/logger";
import { MAX_ENTITIES } from "../../shared/world/world";
import { GameLoop } from "./GameLoop";
import { GameRoom } from "./room";
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
export { MovingEntity } from "./world/moving";
export { POSITION_EPSILON, PositionEntity } from "./world/position";
export { ROTATION_EPSILON, RotationEntity } from "./world/rotation";
export { World } from "./world/world";
// Server-only pieces a game builds on.
export { GameLoop } from "./GameLoop";
export { GameRoom } from "./room";
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
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, D extends EntityDefinitions = EntityDefinitions> = {
	readonly capacity?: number;
	readonly entities?: EntityRegistry<D>;
	readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
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
export class Engine<const In extends readonly string[] = [], const Out extends readonly string[] = [], const InSchemas extends SchemasFor<InSchemas, In> = {}, const OutSchemas extends SchemasFor<OutSchemas, Out> = {}, const D extends EntityDefinitions = EntityDefinitions> extends EventEmitter<EngineEvents> {
	public readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
	public readonly loop: GameLoop;
	public readonly rooms: Map<number, GameRoom<D>>;

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
	private readonly roomsByInviteCode: Map<string, GameRoom<D>>;

	public constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, D> = {}) {
		super();

		const capacity = options.capacity ?? DEFAULT_ROOM_CAPACITY;

		if (capacity < 1 || capacity > MAX_ENTITIES) {
			throw new Error(`Room capacity must be between 1 and ${MAX_ENTITIES}, got ${capacity}`);
		}

		this.capacity = capacity;
		this.entities = options.entities;

		this.network = new NetworkSystem<In, Out, InSchemas, OutSchemas>(options.network);
		this.loop = new GameLoop();
		this.rooms = new Map();
		this.roomIDs = new IDAllocator();
		this.roomsByInviteCode = new Map();
	}

	/**
	 * Open a match. Whatever it needs beyond entities — a sync loop, a round timer — is built by
	 * the caller against the room it just got, and subscribes itself with `room.onUpdate`.
	 */
	public createRoom(inviteCode: string = randomUUID()): GameRoom<D> {
		if (this.roomsByInviteCode.has(inviteCode)) {
			throw new Error(`A room with invite code "${inviteCode}" already exists`);
		}

		const room = new GameRoom<D>(this.roomIDs.allocate(), inviteCode, { capacity: this.capacity, entities: this.entities });

		this.rooms.set(room.id, room);
		this.roomsByInviteCode.set(inviteCode, room);

		return room;
	}

	public getRoom(id: number): GameRoom<D> | undefined {
		return this.rooms.get(id);
	}

	public getRoomByInviteCode(inviteCode: string): GameRoom<D> | undefined {
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
