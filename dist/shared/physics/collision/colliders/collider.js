import { Vector3 } from "../../../libs/math/vector3D";
import { isMovingBody } from "../../body";
import { collide } from "../resolvers/collide";
import { resolve } from "../resolvers/resolve";
export class Collider {
    constructor() {
        this.offset = new Vector3();
        this.isStatic = false;
        this.restitution = 0;
        this.friction = 0;
        this.enabled = true;
    }
    attach(entity) {
        this.entity = entity;
        this.body = isMovingBody(entity) ? entity : undefined;
        entity.collider = this;
        return this;
    }
    detach() {
        if (this.entity?.collider === this) {
            this.entity.collider = undefined;
        }
        this.entity = undefined;
        this.body = undefined;
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
    resolve(other, options) {
        const collider = other instanceof Collider ? other : other.collider;
        const collision = this.collide(collider ?? this);
        if (collision !== undefined && collider !== undefined) {
            resolve(this, collider, collision, options);
        }
        return collision;
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
