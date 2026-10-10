import { BufferReader } from "@nasselk/binarypack";
import { Vector3 } from "../../../../shared/math/vector3";
import { Quaternion } from "../../../../shared/math/quaternion";
import { Group, Vector3Like } from "three";
import type { EntityOptions } from "../../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "../world";
export type PositionEntityOptions = EntityOptions & {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly pitch?: number;
    readonly yaw?: number;
    readonly roll?: number;
};
export declare abstract class PositionEntity<C> extends Entity<C> {
    readonly position: Vector3;
    readonly targetPosition: Vector3;
    readonly rotation: Quaternion;
    readonly targetRotation: Quaternion;
    readonly group: Group;
    constructor(world: World<any, any>, context: C, options?: PositionEntityOptions);
    onSpawn(): void;
    onDestroy(): void;
    teleport(position: Vector3Like): void;
    teleport(x: number, y: number, z: number): void;
    update(deltaTime: number): void;
    protected updatePosition(deltaTime: number): void;
    protected updateRotation(deltaTime: number): void;
    protected syncGroup(): void;
    deserialize(reader: BufferReader): void;
    deserializeUpdate(reader: BufferReader): void;
    get yaw(): number;
}
