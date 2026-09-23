import type { BufferReader } from "@nasselk/binarypack";
import { Entity as BaseEntity, type EntityOptions } from "../../../../shared/world/entity";
import type { World } from "../world";
export declare abstract class Entity<C> extends BaseEntity<C> {
    readonly world: World<any, any>;
    constructor(world: World<any, any>, context: C, _options?: EntityOptions);
    abstract render(deltaTime: number): void;
    abstract deserialize(reader: BufferReader): void;
    abstract deserializeUpdate(reader: BufferReader): void;
}
