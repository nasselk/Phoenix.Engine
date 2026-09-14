import { Vector3 } from "../../../../shared/libs/math/vector3D";
import { collide } from "./collide";
export class Collider {
    constructor() {
        this.offset = new Vector3();
        this.isStatic = false;
        this.enabled = true;
    }
    attach(entity) {
        this.entity = entity;
        entity.collider = this;
        return this;
    }
    detach() {
        if (this.entity?.collider === this) {
            this.entity.collider = undefined;
        }
        this.entity = undefined;
        return this;
    }
    center(out = new Vector3()) {
        const { entity, offset } = this;
        if (entity === undefined) {
            return out.set(offset);
        }
        return out.set(entity.position).add(offset);
    }
    collide(other) {
        const collider = other instanceof Collider ? other : other.collider;
        if (collider === undefined || collider === this || !this.enabled || !collider.enabled) {
            return undefined;
        }
        return collide(this, collider);
    }
    intersects(other) {
        return this.collide(other) !== undefined;
    }
    separate(other) {
        const collision = this.collide(other);
        const entity = this.entity;
        if (collision === undefined || entity === undefined || this.isStatic) {
            return collision;
        }
        entity.position.add(collision.normal, collision.depth);
        return collision;
    }
}
