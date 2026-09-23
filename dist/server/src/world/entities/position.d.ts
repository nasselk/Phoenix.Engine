import type { ColliderDesc, RigidBody, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../../shared/libs/math/vector3D";
import type { EntityOptions } from "../../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "../world";
export declare const POSITION_EPSILON = 0.000001;
export declare const ROTATION_EPSILON = 0.01;
export type PositionEntityOptions = EntityOptions & {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
    readonly pitch?: number;
    readonly yaw?: number;
    readonly roll?: number;
};
export declare abstract class PositionEntity<C> extends Entity<C> {
    private static readonly quaternion;
    private static readonly euler;
    readonly position: ObservableVector3;
    readonly rotation: ObservableVector3;
    body?: RigidBody;
    private turns;
    constructor(world: World<any, any>, context: C, options?: PositionEntityOptions);
    protected embody(body: RigidBodyDesc, ...shapes: readonly ColliderDesc[]): RigidBody;
    beforePhysics(): void;
    afterPhysics(): void;
    onDestroy(): void;
    clean(): void;
    serialize(writer: BufferWriter): void;
    serializeUpdate(writer: BufferWriter): void;
    protected get room(): World<any, any>;
    get yaw(): number;
    set yaw(value: number);
    get isDirty(): boolean;
}
