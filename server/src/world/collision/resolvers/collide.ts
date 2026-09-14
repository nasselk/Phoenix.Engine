import type { BoxCollider } from "../colliders/box";
import { collideBoxBox } from "./boxBox";
import { collideBoxPlane } from "./boxPlane";
import type { Collider } from "../colliders/collider";
import { ColliderKind, type Collision } from "../kind";
import type { PlaneCollider } from "../colliders/plane";

export function collide(a: Collider, b: Collider): Collision | undefined {
	if (a.kind === ColliderKind.Box) {
		if (b.kind === ColliderKind.Box) {
			return collideBoxBox(a as BoxCollider, b as BoxCollider);
		}

		return collideBoxPlane(a as BoxCollider, b as PlaneCollider);
	}

	if (b.kind === ColliderKind.Box) {
		const collision = collideBoxPlane(b as BoxCollider, a as PlaneCollider);

		return collision === undefined ? undefined : { normal: collision.normal.scale(-1), depth: collision.depth };
	}

	return undefined;
}
