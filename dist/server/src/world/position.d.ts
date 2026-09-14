import type { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import type { Collider } from "./collision/colliders/collider";
import type { Engine } from "..";
import type { EntityOptions } from "../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "./world";
export declare const POSITION_EPSILON = 0.01;
export declare const ROTATION_EPSILON = 0.01;
export type PositionEntityOptions = EntityOptions & {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly pitch?: number;
    readonly yaw?: number;
    readonly roll?: number;
};
export declare abstract class PositionEntity<C = Engine> extends Entity<C> {
    readonly position: ObservableVector3;
    readonly rotation: ObservableVector3;
    collider?: Collider;
    constructor(world: World<any, any>, context: C, options?: PositionEntityOptions);
    get yaw(): number;
    set yaw(value: number);
    get isDirty(): boolean;
    clean(): void;
    serialize(writer: BufferWriter): void;
    serializeUpdate(writer: BufferWriter): void;
    protected writeTransforms(writer: BufferWriter): void;
}
