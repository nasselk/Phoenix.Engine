import { BufferWriter } from "@nasselk/binarypack";
import { warn } from "../../../shared/utils/logger";
import type { EntityDefinitions, EntityRegistry } from "../../../shared/world/registry";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import { Entity } from "./entity";

export class World<D extends EntityDefinitions = EntityDefinitions> extends BaseWorld<Entity, D> {
	private readonly pendingSpawns: Entity[] = [];
	private readonly pendingDespawns: number[] = [];

	public constructor(options: WorldOptions<D> = {}) {
		super({ ...options, role: options.role ?? "authority" });

		if (this.role !== "authority") {
			return;
		}

		this.on("spawn", (entity) => this.pendingSpawns.push(entity as Entity));
		this.on("destroy", (entity) => this.pendingDespawns.push(entity.id));
	}

	public serialize(writer: BufferWriter = new BufferWriter()): BufferWriter {
		const registry = this.requireRegistry("serialize");
		const list = this.list;
		const countOffset = writer.advanceBytes(2);
		let count = 0;

		for (let i = 0; i < list.length; i++) {
			const entity = list[i]!;

			if (entity.alive && this.writeSpawn(writer, registry, entity)) {
				count++;
			}
		}

		writer.writeUint16(count, countOffset);

		writer.writeUint16(0);
		writer.writeUint16(0);

		return writer;
	}

	public serializeSync(writer: BufferWriter): boolean {
		const registry = this.requireRegistry("serializeSync");
		const spawns = this.pendingSpawns;
		const despawns = this.pendingDespawns;
		const list = this.list;
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

		for (let i = 0; i < list.length; i++) {
			const entity = list[i]!;

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

	private writeSpawn(writer: BufferWriter, registry: EntityRegistry<D>, entity: Entity): boolean {
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
