import type { BufferReader } from "@nasselk/binarypack";
import type { EntityDefinitions } from "../../../shared/world/registry";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import { Entity } from "./entity";
export type WorldRoleless<D extends EntityDefinitions = EntityDefinitions> = Omit<WorldOptions<D>, "role">;
export declare class World<D extends EntityDefinitions = EntityDefinitions> extends BaseWorld<Entity, D> {
    sync(reader: BufferReader): void;
}
