import type { BufferReader } from "@nasselk/binarypack";
import { Entity as BaseEntity, type EntityOptions } from "../../../../shared/world/entity";
import type { World } from "../world";

/** `C` is what `this.context` is. */
export abstract class Entity<C> extends BaseEntity<C> {
	declare public readonly world: World<any, any>;

	/**
	 * Built by `world.spawn(kind, options)`, or by the world itself off the wire — where there are no
	 * options beyond an id, so every client option needs a default.
	 */
	public constructor(world: World<any, any>, context: C, _options: EntityOptions = {}) {
		super(world, context);
	}

	public abstract render(deltaTime: number): void;

	public abstract deserialize(reader: BufferReader): void;

	public abstract deserializeUpdate(reader: BufferReader): void;
}
