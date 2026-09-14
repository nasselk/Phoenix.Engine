import type { BufferReader } from "@nasselk/binarypack";
import type { EntityDefinitions } from "../../../shared/world/registry";
import type { SpawnArguments } from "../../../shared/world/options";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { Entity } from "./entity";
export type ClientWorldOptions<D extends EntityDefinitions = EntityDefinitions, C = unknown, G = unknown> = WorldOptions<D, C> & {
    readonly group?: G;
};
export type WorldRoleless<D extends EntityDefinitions = EntityDefinitions, C = unknown, G = unknown> = Omit<ClientWorldOptions<D, C, G>, "role">;
export declare class World<D extends EntityDefinitions = EntityDefinitions, C = unknown, G = unknown> extends BaseWorld<D, C, Entity<C, G>> {
    readonly group: G;
    constructor(options?: ClientWorldOptions<D, C, G>);
    spawn<K extends Extract<keyof D, string>>(kind: K, ...args: SpawnArguments<D[K], 3>): InstanceType<D[K]>;
    sync(reader: BufferReader): void;
}
