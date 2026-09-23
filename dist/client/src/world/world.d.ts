import type { BufferReader } from "@nasselk/binarypack";
import type { EntityDefinitions } from "../../../shared/world/registry";
import { Group } from "three";
import type { SpawnArguments } from "../../../shared/world/options";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { Entity } from "./entities/entity";
export type ClientWorldOptions<D extends EntityDefinitions, C> = WorldOptions<D, C>;
export declare class World<D extends EntityDefinitions, C> extends BaseWorld<D, C, Entity<C>> {
    readonly group: Group<import("three").Object3DEventMap>;
    protected allocateID(): number;
    spawn<K extends Extract<keyof D, string>>(kind: K, ...args: SpawnArguments<D[K], 2>): InstanceType<D[K]>;
    sync(reader: BufferReader): void;
    destroy(): void;
}
