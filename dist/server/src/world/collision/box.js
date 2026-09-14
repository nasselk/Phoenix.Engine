import { Vector3 } from "../../../../shared/libs/math/vector3D";
import { Collider } from "./collider";
import { ColliderKind } from "./kind";
export class BoxCollider extends Collider {
    constructor(width = 1, height = width, depth = width) {
        super();
        this.kind = ColliderKind.Box;
        this.halfExtents = new Vector3(width / 2, height / 2, depth / 2);
    }
    setSize(width, height = width, depth = width) {
        this.halfExtents.set(width / 2, height / 2, depth / 2);
        return this;
    }
}
