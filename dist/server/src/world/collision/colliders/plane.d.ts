import { Vector3 } from "../../../../../shared/libs/math/vector3D";
import { Collider } from "./collider";
import { ColliderKind } from "../kind";
export declare class PlaneCollider extends Collider {
    readonly kind = ColliderKind.Plane;
    readonly normal: Vector3;
    constructor(x?: number, y?: number, z?: number);
}
