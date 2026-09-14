import { BufferWriter } from "@nasselk/binarypack";
import type { EntityDefinitions } from "../../../shared/world/registry";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { SpawnArguments } from "../../../shared/world/options";
import type { Entity } from "./entity";
export type ServerWorldOptions<D extends EntityDefinitions = EntityDefinitions, C = unknown> = WorldOptions<D, C> & {
    readonly id?: number;
    readonly inviteCode?: string;
};
export declare const MAX_SERVER_WORLD_SIZE: number;
export declare class World<D extends EntityDefinitions = EntityDefinitions, C = unknown> extends BaseWorld<D, C, Entity<C>> {
    readonly id: number;
    readonly inviteCode: string;
    private readonly pendingSpawns;
    private readonly pendingDespawns;
    constructor(options?: ServerWorldOptions<D, C>);
    spawn<K extends Extract<keyof D, string>>(kind: K, ...args: SpawnArguments<D[K], 2>): InstanceType<D[K]>;
    serialize(writer?: BufferWriter): BufferWriter;
    protected allocateID(): number;
    serializeSync(writer: BufferWriter): boolean;
    dispose(): void;
    private writeSpawn;
}
