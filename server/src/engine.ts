import { credit, log } from "../../shared/utils/logger";
import { initPhysics } from "../../shared/physics/rapier";
import { GameLoop, type GameLoopParams } from "./GameLoop";
import { World } from "./world/world";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "../../shared/networking/invite";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import type { ContractOf, SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions, EntityRegistry } from "../../shared/world/registry";
import { EventEmitter } from "../../shared/utils/EventEmitter";

type EngineEvents = {
	init: [];
	destroy: [];
};

/** How many random codes `createRoom` tries before it gives up on finding one no open room has. */
export const MAX_INVITE_CODE_ATTEMPTS = 100;

/** Everything the engine is handed: the room capacity, and optionally the networking to bring up with it. */
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, D extends EntityDefinitions = EntityDefinitions, C = never> = {
	readonly entities: EntityRegistry<D>;
	readonly context?: C;
	readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
	readonly loop?: Partial<GameLoopParams>;
	readonly rooms?: {
		maximum?: number;
		maxSessions?: number;
	};
};

type ContextOf<C, Self> = [C] extends [never] ? Self : C;

/**
 * One per process. Owns the room registry and the single timer that drives
 * every room.
 *
 * Rooms are not given their own GameLoop on purpose: N timers on one thread
 * drift independently and compete for the same event loop, where one loop
 * fanning out over the rooms ticks them in a deterministic order and gives you
 * one place to measure the whole process's tick budget.
 */
export class Engine<const In extends readonly string[] = [], const Out extends readonly string[] = [], const InSchemas extends SchemasFor<InSchemas, In> = {}, const OutSchemas extends SchemasFor<OutSchemas, Out> = {}, const D extends EntityDefinitions = EntityDefinitions, C = never> extends EventEmitter<EngineEvents> {
	public readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
	public readonly loop: GameLoop;
	/** Every open room, by invite code. */
	public readonly rooms: Map<string, World<D, ContextOf<C, this>, ContractOf<In, Out, InSchemas, OutSchemas>>>;

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
	private readonly entities: EntityRegistry<D>;
	private readonly roomsConfig: EngineOptions["rooms"];

	/** Handed to every room this engine opens. */
	private readonly context: ContextOf<C, this>;

	public constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, D, C>) {
		super();

		this.entities = options.entities;
		this.context = (options.context ?? this) as ContextOf<C, this>;
		this.network = new NetworkSystem<In, Out, InSchemas, OutSchemas>(options.network);
		this.loop = new GameLoop(options.loop);
		this.rooms = new Map();

		this.roomsConfig = {
			maximum: Infinity,
			...options.rooms,
		};
	}

	public async init(): Promise<void> {
		credit("Server");

		log("Phoenix Server", "Initializing the engine...");

		// Every room owns a physics world, so none can open until Rapier is loaded.
		await initPhysics();

		this.loop.on("tick", (deltaTime) => {
			for (const room of this.rooms.values()) {
				room.update(deltaTime);
			}
		});

		this.loop.resume();

		log("Phoenix Server", "Successfully initiated the engine");

		this.emit("init");
	}

	/**
	 * Open a match under that invite code, or under a free random one of INVITE_CODE_LENGTH
	 * characters from INVITE_CODE_ALPHABET. Whatever it needs beyond entities — a sync loop, a round
	 * timer — is built by the caller against the room it just got, and listens for `room.on("update")`.
	 */
	public createRoom(inviteCode: string = this.freeInviteCode()): World<D, ContextOf<C, this>, ContractOf<In, Out, InSchemas, OutSchemas>> {
		if (this.rooms.has(inviteCode)) {
			throw new Error(`A room with invite code "${inviteCode}" already exists`);
		}

		if (this.rooms.size === this.roomsConfig?.maximum) {
			throw new Error(`The engine is at its maximum of ${this.roomsConfig.maximum} rooms`);
		}

		const room = new World<D, ContextOf<C, this>, ContractOf<In, Out, InSchemas, OutSchemas>>({ inviteCode, capacity: this.roomsConfig?.maximum, entities: this.entities, context: this.context, network: this.network });

		this.rooms.set(inviteCode, room);

		return room;
	}

	public getRoom(inviteCode: string): World<D, ContextOf<C, this>, ContractOf<In, Out, InSchemas, OutSchemas>> | undefined {
		return this.rooms.get(inviteCode);
	}

	/** Tears the room down — every system's destroy() runs, every entity goes — and frees its code. */
	public destroyRoom(inviteCode: string): boolean {
		const room = this.rooms.get(inviteCode);

		if (room === undefined) {
			return false;
		}

		room.destroy();

		this.rooms.delete(inviteCode);

		return true;
	}

	public destroy(): void {
		for (const inviteCode of [...this.rooms.keys()]) {
			this.destroyRoom(inviteCode);
		}

		this.network.destroy();
		this.loop.destroy();

		this.emit("destroy");

		this.removeAllListeners();
	}

	private freeInviteCode(): string {
		for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
			let code = "";

			for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
				code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
			}

			if (!this.rooms.has(code)) {
				return code;
			}
		}

		throw new Error(`No free invite code after ${MAX_INVITE_CODE_ATTEMPTS} attempts: too many rooms are open`);
	}
}
