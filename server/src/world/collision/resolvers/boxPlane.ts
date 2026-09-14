import { Vector3 } from "../../../../../shared/libs/math/vector3D";
import type { BoxCollider } from "../colliders/box";
import type { Collision } from "../kind";
import type { PlaneCollider } from "../colliders/plane";

const center = new Vector3();
const origin = new Vector3();

export function collideBoxPlane(box: BoxCollider, plane: PlaneCollider): Collision | undefined {
	const { normal } = plane;
	const { halfExtents } = box;

	box.center(center);
	plane.center(origin);

	const reach = Math.abs(normal.x * halfExtents.x) + Math.abs(normal.y * halfExtents.y) + Math.abs(normal.z * halfExtents.z);
	const depth = reach - (normal.dot(center) - normal.dot(origin));

	if (depth <= 0) {
		return undefined;
	}

	return { normal: normal.clone(), depth };
}
