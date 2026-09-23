import type { BufferWriter } from "@nasselk/binarypack";
import { Entity as BaseEntity, type EntityOptions } from "../../../../shared/world/entity";
import { Slot } from "../replication";
import type { World } from "../world";

/** `C` is what `this.context` is, handed down by the world. Without a context of its own, a world's context is the engine. */
export abstract class Entity<C> extends BaseEntity<C> {
	/** Where this tick's encoded records are. Its room's replication writes it; nothing else reads it. */
	public readonly slot: Slot;

	public constructor(world: World<any, any>, context: C, _options: EntityOptions = {}) {
		super(world, context);

		this.slot = new Slot();
	}

	public abstract serialize(writer: BufferWriter): void;

	public abstract serializeUpdate(writer: BufferWriter): void;

	public get isDirty(): boolean {
		return false;
	}

	public clean(): void {}
}
