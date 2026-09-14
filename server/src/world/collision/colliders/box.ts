import { Vector3 } from "../../../../../shared/libs/math/vector3D";
import { Collider } from "./collider";
import { ColliderKind } from "../kind";

export class BoxCollider extends Collider {
	public override readonly kind = ColliderKind.Box;

	public readonly halfExtents: Vector3;

	public constructor(width: number = 1, height: number = width, depth: number = width) {
		super();

		this.halfExtents = new Vector3(width / 2, height / 2, depth / 2);
	}

	public setSize(width: number, height: number = width, depth: number = width): this {
		this.halfExtents.set(width / 2, height / 2, depth / 2);

		return this;
	}
}
