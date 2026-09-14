import { Vector3 } from "../../../../../shared/libs/math/vector3D";
import { Collider } from "./collider";
import { ColliderKind } from "../kind";

export class PlaneCollider extends Collider {
	public override readonly kind = ColliderKind.Plane;

	public readonly normal: Vector3;

	public constructor(x: number = 0, y: number = 1, z: number = 0) {
		super();

		if (x === 0 && y === 0 && z === 0) {
			throw new Error("A PlaneCollider needs a direction to face; (0, 0, 0) is not one.");
		}

		this.normal = new Vector3(x, y, z).normalize();
		this.isStatic = true;
	}
}
