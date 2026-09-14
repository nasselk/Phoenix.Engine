import { Vector3 } from "../../../../shared/libs/math/vector3D";
import { Collider } from "./collider";
import { ColliderKind } from "./kind";
export class PlaneCollider extends Collider {
    constructor(x = 0, y = 1, z = 0) {
        super();
        this.kind = ColliderKind.Plane;
        this.normal = new Vector3(x, y, z).normalize();
        this.isStatic = true;
    }
}
