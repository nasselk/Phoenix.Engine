import type { Vector3 } from "../../libs/math/vector3D";
export declare const enum ColliderKind {
    Box = 0,
    Plane = 1
}
export type Collision = {
    readonly normal: Vector3;
    readonly depth: number;
};
