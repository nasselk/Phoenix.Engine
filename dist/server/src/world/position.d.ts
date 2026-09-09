import type { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import { Entity } from "./entity";
export declare const POSITION_EPSILON = 0.01;
export declare class PositionEntity extends Entity {
    readonly position: ObservableVector3;
    constructor(x?: number, y?: number, z?: number);
    get isDirty(): boolean;
    clean(): void;
    serialize(writer: BufferWriter): void;
    serializeUpdate(writer: BufferWriter): void;
    protected writePosition(writer: BufferWriter): void;
}
