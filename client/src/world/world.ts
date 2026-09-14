import type { BufferReader } from "@nasselk/binarypack";
import { warn } from "../../../shared/utils/logger";
import type { EntityDefinitions } from "../../../shared/world/registry";
import type { EntityOptions } from "../../../shared/world/entity";
import type { OptionsOf, SpawnArguments } from "../../../shared/world/options";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { Entity } from "./entity";

export type ClientWorldOptions<D extends EntityDefinitions = EntityDefinitions, C = unknown, G = unknown> = WorldOptions<D, C> & {
	/** The scene container every entity in this world draws into, handed to each as `entity.group`. */
	readonly group?: G;
};

export type WorldRoleless<D extends EntityDefinitions = EntityDefinitions, C = unknown, G = unknown> = Omit<ClientWorldOptions<D, C, G>, "role">;

export class World<D extends EntityDefinitions = EntityDefinitions, C = unknown, G = unknown> extends BaseWorld<D, C, Entity<C, G>> {
	public readonly group: G;

	public constructor(options: ClientWorldOptions<D, C, G> = {}) {
		super(options);

		this.group = options.group as G;
	}

	/**
	 * Build an entity of a registered kind and put it in this world, drawing into the world's group:
	 *
	 *   world.spawn("crate", { x: 4, z: -2 });
	 *
	 * The options are that kind's own, typed from its constructor. `id` spawns under a specific id.
	 */
	public spawn<K extends Extract<keyof D, string>>(kind: K, ...args: SpawnArguments<D[K], 3>): InstanceType<D[K]> {
		const Kind = this.requireRegistry("spawn").class(kind);
		const options = (args[0] ?? {}) as OptionsOf<D[K], 3> & EntityOptions;

		const entity = new Kind(this, this.context, this.group, options) as InstanceType<D[K]>;

		return this.insert(kind, entity, options.id);
	}

	public sync(reader: BufferReader): void {
		const registry = this.requireRegistry("sync");
		const spawns = reader.readUint16();

		for (let i = 0; i < spawns; i++) {
			const code = reader.readUint8();
			const id = reader.readUint16();
			const length = reader.readUint16();
			const end = reader.offset + length;
			const kind = registry.name(code);

			if (kind === undefined) {
				warn("World", `Ignoring a spawn of unknown entity kind ${code}; this build knows [ ${registry.describe()} ]`);
			} else {
				const existing = this.entities.get(id);

				if (existing !== undefined && existing.kind === kind) {
					existing.deserialize(reader);
				} else {
					if (existing !== undefined) {
						existing.destroy();
					}

					// Off the wire there are no options but the id: the entity's state arrives in deserialize.
					const entity = new (registry.class(kind))(this, this.context, this.group, { id }) as Entity<any, any>;

					entity.deserialize(reader);
					this.insert(kind, entity, id);
				}
			}

			reader.offset = end;
			reader.resetBits();
		}

		const updates = reader.readUint16();

		for (let i = 0; i < updates; i++) {
			const id = reader.readUint16();
			const length = reader.readUint16();
			const end = reader.offset + length;

			this.entities.get(id)?.deserializeUpdate(reader);

			reader.offset = end;
			reader.resetBits();
		}

		const despawns = reader.readUint16();

		for (let i = 0; i < despawns; i++) {
			this.entities.get(reader.readUint16())?.destroy();
		}
	}
}
