import type { BufferReader } from "@nasselk/binarypack";
import { ObservableVector3, Vector3 } from "../../../shared/libs/math/vector3D";
import { PositionEntity } from "./position";
export declare const SNAP_ANGLE = 0.0005;
export declare class RotationEntity extends PositionEntity {
    readonly rotation: ObservableVector3;
    readonly targetRotation: Vector3;
    rotationInterpolation: boolean;
    rotationSmoothing: number;
    constructor(x?: number, y?: number, z?: number, pitch?: number, yaw?: number, roll?: number);
    get yaw(): number;
    set yaw(value: number);
    deserialize(reader: BufferReader): void;
    deserializeUpdate(reader: BufferReader): void;
    update(deltaTime: number): void;
    protected readRotation(reader: BufferReader): void;
}
