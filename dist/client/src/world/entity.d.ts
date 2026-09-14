import type { BufferReader } from "@nasselk/binarypack";
import { Entity as BaseEntity, type EntityOptions } from "../../../shared/world/entity";
import type { Engine } from "..";
import type { World } from "./world";
export declare abstract class Entity<C = Engine, G = unknown> extends BaseEntity<C> {
    readonly group: G;
    constructor(world: World<any, any, any>, context: C, group: G, _options?: EntityOptions);
    abstract render(deltaTime: number): void;
    abstract deserialize(reader: BufferReader): void;
    abstract deserializeUpdate(reader: BufferReader): void;
}
