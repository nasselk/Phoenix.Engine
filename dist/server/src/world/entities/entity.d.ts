import type { BufferWriter } from "@nasselk/binarypack";
import { Entity as BaseEntity, type EntityOptions } from "../../../../shared/world/entity";
import { Slot } from "../replication";
import type { World } from "../world";
export declare abstract class Entity<C> extends BaseEntity<C> {
    readonly slot: Slot;
    constructor(world: World<any, any>, context: C, _options?: EntityOptions);
    abstract serialize(writer: BufferWriter): void;
    abstract serializeUpdate(writer: BufferWriter): void;
    get isDirty(): boolean;
    clean(): void;
}
