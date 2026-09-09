import type { BufferReader } from "@nasselk/binarypack";
import { ObservableVector3, Vector3 } from "../../../shared/libs/math/vector3D";
import { Entity } from "./entity";
export declare const FRAME: number;
export declare const DEFAULT_SMOOTHING = 0.25;
export declare const SNAP_DISTANCE = 0.001;
export declare class PositionEntity extends Entity {
    readonly position: ObservableVector3;
    readonly targetPosition: Vector3;
    interpolation: boolean;
    smoothing: number;
    constructor(x?: number, y?: number, z?: number);
    deserialize(reader: BufferReader): void;
    deserializeUpdate(reader: BufferReader): void;
    update(deltaTime: number): void;
    protected readPosition(reader: BufferReader): void;
}
