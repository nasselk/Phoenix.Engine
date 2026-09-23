import type { BufferReader } from "@nasselk/binarypack";
import type { EntityDefinitions } from "../../../shared/world/registry";
import { Group } from "three";
import type { EntityOptions } from "../../../shared/world/entity";
import type { OptionsOf, SpawnArguments } from "../../../shared/world/options";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { Entity } from "./entities/entity";

export type ClientWorldOptions<D extends EntityDefinitions, C> = WorldOptions<D, C>;

export class World<D extends EntityDefinitions, C> extends BaseWorld<D, C, Entity<C>> {
	/** This world in the scene: every entity's group goes in here. Whoever renders the world adds it to a scene. */
	public readonly group = new Group();

	/**
	 * Negative ids, for entities this client spawns itself. Replicated entities arrive with the
	 * server's positive ids, so the two ranges can never collide, and nothing here ever goes on the wire.
	 */
	protected override allocateID(): number {
		return this.ids.allocateNegative();
	}

	public spawn<K extends Extract<keyof D, string>>(kind: K, ...args: SpawnArguments<D[K], 2>): InstanceType<D[K]> {
		const Kind = this.registry.class(kind);
		const options = (args[0] ?? {}) as OptionsOf<D[K], 2> & EntityOptions;

		const entity = new Kind(this, this.context, options) as InstanceType<D[K]>;

		return this.insert(kind, entity, options.id);
	}

	/**
	 * Apply a frame from the server's `room.frame`: despawns, then spawns, then updates.
	 *
	 * Records carry no length, so each entity reads exactly what its server side wrote, and the next
	 * record starts where it stops. A spawn of a kind this build does not know, or an update for an
	 * entity this world does not have, leaves the rest of the frame unreadable, so both throw. Only the
	 * server's despawns remove a replicated entity: one destroyed here would break the next frame that updates it.
	 */
	public sync(reader: BufferReader): void {
		const registry = this.registry;
		const despawns = reader.readUint16();

		for (let i = 0; i < despawns; i++) {
			this.get(reader.readUint16())?.destroy();
		}

		const spawns = reader.readUint16();

		for (let i = 0; i < spawns; i++) {
			const code = reader.readUint8();
			const id = reader.readUint16();
			const kind = registry.kind(code);

			if (kind === undefined) {
				throw new Error(`Entity ${id} spawned as unknown kind ${code}, so the rest of the frame cannot be read; this build knows [ ${registry.describe()} ]`);
			}

			const existing = this.get(id);

			if (existing !== undefined && existing.kind === kind) {
				existing.deserialize(reader);
			} else {
				existing?.destroy();

				// Off the wire there are no options but the id: the entity's state arrives in deserialize.
				const entity = new (registry.class(kind))(this, this.context, { id }) as Entity<any>;

				entity.deserialize(reader);
				this.insert(kind, entity, id);
			}

			reader.resetBits();
		}

		const updates = reader.readUint16();

		for (let i = 0; i < updates; i++) {
			const id = reader.readUint16();
			const entity = this.get(id);

			if (entity === undefined) {
				throw new Error(`Update for entity ${id}, which this world does not have, so the rest of the frame cannot be read`);
			}

			entity.deserializeUpdate(reader);

			reader.resetBits();
		}
	}

	public override destroy(): void {
		super.destroy();

		this.group.removeFromParent();
	}
}
