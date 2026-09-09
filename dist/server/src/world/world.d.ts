import { BufferWriter } from "@nasselk/binarypack";
import type { EntityDefinitions } from "../../../shared/world/registry";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import { Entity } from "./entity";
export declare class World<D extends EntityDefinitions = EntityDefinitions> extends BaseWorld<Entity, D> {
    private readonly pendingSpawns;
    private readonly pendingDespawns;
    constructor(options?: WorldOptions<D>);
    serialize(writer?: BufferWriter): BufferWriter;
    serializeSync(writer: BufferWriter): boolean;
    dispose(): void;
    private writeSpawn;
}
