import type { BufferReader } from "@nasselk/binarypack";
import { Vector3 } from "../../../shared/libs/math/vector3D";
import type { Engine } from "..";
import type { EntityOptions } from "../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "./world";
export type PositionEntityOptions = EntityOptions & {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly pitch?: number;
    readonly yaw?: number;
    readonly roll?: number;
};
export declare abstract class PositionEntity<C = Engine, G = unknown> extends Entity<C, G> {
    private static readonly FRAMES_PER_SECOND;
    private static readonly DEFAULT_SMOOTHING;
    private static readonly SNAP_DISTANCE;
    private static readonly SNAP_ANGLE;
    readonly position: Vector3;
    readonly targetPosition: Vector3;
    readonly rotation: Vector3;
    readonly targetRotation: Vector3;
    positionSmoothing: boolean;
    smoothing: number;
    rotationInterpolation: boolean;
    rotationSmoothing: number;
    constructor(world: World<any, any, any>, context: C, group: G, options?: PositionEntityOptions);
    update(deltaTime: number): void;
    deserialize(reader: BufferReader): void;
    deserializeUpdate(reader: BufferReader): void;
}
