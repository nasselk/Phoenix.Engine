import type { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import { PositionEntity } from "./position";
export declare const ROTATION_EPSILON = 0.01;
export declare class RotationEntity extends PositionEntity {
    readonly rotation: ObservableVector3;
    constructor(x?: number, y?: number, z?: number, pitch?: number, yaw?: number, roll?: number);
    get yaw(): number;
    set yaw(value: number);
    get isDirty(): boolean;
    clean(): void;
    serialize(writer: BufferWriter): void;
    serializeUpdate(writer: BufferWriter): void;
    protected writeRotation(writer: BufferWriter): void;
}
