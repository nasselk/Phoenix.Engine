import type { BufferReader, BufferWriter } from "@nasselk/binarypack";
import { MovingEntity } from "./moving";
export declare class BoxEntity extends MovingEntity {
    width: number;
    height: number;
    depth: number;
    color: number;
    constructor(x?: number, y?: number, z?: number, width?: number, height?: number, depth?: number, color?: number);
    setSize(width: number, height?: number, depth?: number): this;
    serialize(writer: BufferWriter): void;
    deserialize(reader: BufferReader): void;
}
export declare class Floor extends BoxEntity {
    constructor(size?: number, thickness?: number, color?: number);
}
