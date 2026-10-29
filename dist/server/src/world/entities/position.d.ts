import type { ColliderDesc, RigidBody, RigidBodyDesc } from "@dimforge/rapier3d-simd-compat";
import type { BufferWriter } from "@nasselk/binarypack";
import type { Vector3Like } from "three";
import { ObservableQuaternion } from "../../../../shared/math/quaternion";
import { ObservableVector3 } from "../../../../shared/math/vector3";
import type { EntityOptions } from "../../../../shared/world/entity";
import type { World } from "../world";
import { Entity } from "./entity";
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
    readonly position: ObservableVector3;
    readonly rotation: ObservableQuaternion;
    body?: RigidBody;
    private turns;
    private readonly pushed;
    private fixed;
    private readonly pushedPosition;
    private asleep;
    private readonly touching;
    constructor(world: World<any, any>, context: C, options?: PositionEntityOptions);
    protected embody(body: RigidBodyDesc, ...shapes: readonly ColliderDesc[]): RigidBody;
    onTouch(other: PositionEntity<any>): void;
    onTouchEnd(other: PositionEntity<any>): void;
    touch(other: PositionEntity<any>, started: boolean): void;
    isTouching(other: PositionEntity<any>): boolean;
    private untouchAll;
    beforePhysics(): void;
    afterPhysics(): void;
    onDestroy(): void;
    teleport(position: Vector3Like): void;
    teleport(x: number, y: number, z: number): void;
    clean(): void;
    serialize(writer: BufferWriter): void;
    serializeUpdate(writer: BufferWriter): void;
    protected get room(): World<any, any>;
    get yaw(): number;
    set yaw(value: number);
    get isDirty(): boolean;
}
//# sourceMappingURL=position.d.ts.map