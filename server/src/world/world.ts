import { BufferWriter } from "@nasselk/binarypack";
import { warn } from "../../../shared/utils/logger";
import type { EntityDefinitions, EntityRegistry } from "../../../shared/world/registry";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { OptionsOf, SpawnArguments } from "../../../shared/world/options";
import type { EntityOptions } from "../../../shared/world/entity";
import type { Entity } from "./entity";

export type ServerWorldOptions<D extends EntityDefinitions = EntityDefinitions, C = unknown> = WorldOptions<D, C> & {
	readonly id?: number;
	readonly inviteCode?: string;
};

export const MAX_SERVER_WORLD_SIZE = 2 ** 16 - 1; // 16 bits

export class World<D extends EntityDefinitions = EntityDefinitions, C = unknown> extends BaseWorld<D, C, Entity<C>> {
	public readonly id: number;

	/** What a socket subscribes to for this world's frames. Empty for a world nobody joins. */
	public readonly inviteCode: string;

	private readonly pendingSpawns: Entity<C>[] = [];
	private readonly pendingDespawns: number[] = [];

	public constructor(options: ServerWorldOptions<D, C> = {}) {
		super({ ...options, role: options.role ?? "authority" });

		if (this.capacity > MAX_SERVER_WORLD_SIZE) {
			throw new Error(`World capacity must be at most ${MAX_SERVER_WORLD_SIZE}, got ${this.capacity}`);
		}

		this.id = options.id ?? 0;
		this.inviteCode = options.inviteCode ?? "";

		if (this.role !== "authority") {
			return;
		}

		this.on("spawn", (entity) => this.pendingSpawns.push(entity as Entity<C>));
		this.on("destroy", (entity) => this.pendingDespawns.push(entity.id));
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
		const Kind = this.requireRegistry("spawn").class(kind);
		const options = (args[0] ?? {}) as OptionsOf<D[K], 2> & EntityOptions;

		const entity = new Kind(this, this.context, options) as InstanceType<D[K]>;

		return this.insert(kind, entity, options.id);
	}

	public serialize(writer: BufferWriter = new BufferWriter()): BufferWriter {
		const registry = this.requireRegistry("serialize");
		const countOffset = writer.advanceBytes(2);
		let count = 0;

		for (const entity of this.entities.values()) {
			if (entity.alive && this.writeSpawn(writer, registry, entity)) {
				count++;
			}
		}

		writer.writeUint16(count, countOffset);

		writer.writeUint16(0);
		writer.writeUint16(0);

		return writer;
	}

	protected override allocateID(): number {
		const id = super.allocateID();

		if (id > MAX_SERVER_WORLD_SIZE) {
			throw new Error(`World id allocation exceeded ${MAX_SERVER_WORLD_SIZE}`);
		}

		return id;
	}

	public serializeSync(writer: BufferWriter): boolean {
		const registry = this.requireRegistry("serializeSync");
		const spawns = this.pendingSpawns;
		const despawns = this.pendingDespawns;
		const start = writer.offset;

		const spawnCountOffset = writer.advanceBytes(2);
		let spawnCount = 0;

		for (let i = 0; i < spawns.length; i++) {
			const entity = spawns[i]!;

			if (entity.alive && this.writeSpawn(writer, registry, entity)) {
				entity.clean();
				spawnCount++;
			}
		}

		writer.writeUint16(spawnCount, spawnCountOffset);
		spawns.length = 0;

		const updateCountOffset = writer.advanceBytes(2);
		let updateCount = 0;

		for (const entity of this.entities.values()) {
			if (!entity.alive || !entity.isDirty) {
				continue;
			}

			writer.writeUint16(entity.id);

			const lengthOffset = writer.advanceBytes(2);
			const payload = writer.offset;

			entity.serializeUpdate(writer);
			writer.resetBits();
			writer.writeUint16(writer.offset - payload, lengthOffset);

			entity.clean();
			updateCount++;
		}

		writer.writeUint16(updateCount, updateCountOffset);

		writer.writeUint16(despawns.length);

		for (let i = 0; i < despawns.length; i++) {
			writer.writeUint16(despawns[i]!);
		}

		const despawnCount = despawns.length;

		despawns.length = 0;

		if (spawnCount === 0 && updateCount === 0 && despawnCount === 0) {
			writer.offset = start;

			return false;
		}

		return true;
	}

	public override dispose(): void {
		super.dispose();

		this.pendingSpawns.length = 0;
		this.pendingDespawns.length = 0;
	}

	private writeSpawn(writer: BufferWriter, registry: EntityRegistry<D>, entity: Entity<C>): boolean {
		if (entity.kind === "") {
			warn("World", `Not replicating entity ${entity.id} (${entity.type}): its class is not in the registry`);

			return false;
		}

		writer.writeUint8(registry.code(entity.kind as Extract<keyof D, string>));
		writer.writeUint16(entity.id);

		const lengthOffset = writer.advanceBytes(2);
		const payload = writer.offset;

		entity.serialize(writer);

		writer.resetBits();
		writer.writeUint16(writer.offset - payload, lengthOffset);

		return true;
	}
}
