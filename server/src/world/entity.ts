import type { BufferWriter } from "@nasselk/binarypack";
import { Entity as BaseEntity, type EntityOptions } from "../../../shared/world/entity";
import type { Engine } from "..";
import type { World } from "./world";

/** `C` is what `this.context` is, handed down by the world. Without a context of its own, a world's context is the engine. */
export abstract class Entity<C = Engine> extends BaseEntity<C> {
	/** Built by `world.spawn(kind, options)`, never directly: that is where the world and context come from. */
	public constructor(world: World<any, any>, context: C, _options: EntityOptions = {}) {
		super(world, context);
	}

	public abstract serialize(writer: BufferWriter): void;

	public abstract serializeUpdate(writer: BufferWriter): void;

	public get isDirty(): boolean {
		return false;
	}

	public clean(): void {}
}
