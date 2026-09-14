import type { Vector3 } from "../../../../shared/libs/math/vector3D";

export const enum ColliderKind {
	Box = 0,
	Plane = 1,
}

export type Collision = {
	readonly normal: Vector3;
	readonly depth: number;
};
