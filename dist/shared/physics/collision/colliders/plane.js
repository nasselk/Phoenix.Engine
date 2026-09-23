import { Vector3 } from "../../../libs/math/vector3D";
import { Collider } from "./collider";
export class PlaneCollider extends Collider {
    constructor(x = 0, y = 1, z = 0) {
        super();
        this.kind = 1;
        if (x === 0 && y === 0 && z === 0) {
            throw new Error("A PlaneCollider needs a direction to face; (0, 0, 0) is not one.");
        }
        this.normal = new Vector3(x, y, z).normalize();
        this.isStatic = true;
    }
}
