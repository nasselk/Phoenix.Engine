import { Vector3 } from "../../../../shared/libs/math/vector3D";
import { Collider } from "./collider";
import { ColliderKind } from "./kind";
export declare class BoxCollider extends Collider {
    readonly kind = ColliderKind.Box;
    readonly halfExtents: Vector3;
    constructor(width?: number, height?: number, depth?: number);
    setSize(width: number, height?: number, depth?: number): this;
}
