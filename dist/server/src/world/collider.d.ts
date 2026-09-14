import { Vector3 } from "../../../shared/libs/math/vector3D";
import type { PositionEntity } from "./position";
export declare enum ColliderKind {
    Box = 0,
    Plane = 1
}
export type Collision = {
    readonly normal: Vector3;
    readonly depth: number;
};
export declare abstract class Collider {
    abstract readonly kind: ColliderKind;
    entity?: PositionEntity;
    readonly offset: Vector3;
    isStatic: boolean;
    enabled: boolean;
    attach(entity: PositionEntity): this;
    detach(): this;
    center(out?: Vector3): Vector3;
    collide(other: Collider | PositionEntity): Collision | undefined;
    intersects(other: Collider | PositionEntity): boolean;
    separate(other: Collider | PositionEntity): Collision | undefined;
}
export declare class BoxCollider extends Collider {
    readonly kind = ColliderKind.Box;
    readonly halfExtents: Vector3;
    constructor(width?: number, height?: number, depth?: number);
    setSize(width: number, height?: number, depth?: number): this;
}
export declare class PlaneCollider extends Collider {
    readonly kind = ColliderKind.Plane;
    readonly normal: Vector3;
    constructor(x?: number, y?: number, z?: number);
}
export declare function collide(a: Collider, b: Collider): Collision | undefined;
export declare function collideBoxBox(a: BoxCollider, b: BoxCollider): Collision | undefined;
export declare function collideBoxPlane(box: BoxCollider, plane: PlaneCollider): Collision | undefined;
