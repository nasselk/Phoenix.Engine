import { Vector3 } from "../../../shared/libs/math/vector3D";
export var ColliderKind;
(function (ColliderKind) {
    ColliderKind[ColliderKind["Box"] = 0] = "Box";
    ColliderKind[ColliderKind["Plane"] = 1] = "Plane";
})(ColliderKind || (ColliderKind = {}));
const center = new Vector3();
const otherCenter = new Vector3();
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
export class PlaneCollider extends Collider {
    constructor(x = 0, y = 1, z = 0) {
        super();
        this.kind = ColliderKind.Plane;
        this.normal = new Vector3(x, y, z).normalize();
        this.isStatic = true;
    }
}
export function collide(a, b) {
    if (a.kind === ColliderKind.Box) {
        if (b.kind === ColliderKind.Box) {
            return collideBoxBox(a, b);
        }
        return collideBoxPlane(a, b);
    }
    if (b.kind === ColliderKind.Box) {
        const collision = collideBoxPlane(b, a);
        return collision === undefined ? undefined : { normal: collision.normal.scale(-1), depth: collision.depth };
    }
    return undefined;
}
export function collideBoxBox(a, b) {
    a.center(center);
    b.center(otherCenter);
    const dx = otherCenter.x - center.x;
    const dy = otherCenter.y - center.y;
    const dz = otherCenter.z - center.z;
    const px = a.halfExtents.x + b.halfExtents.x - Math.abs(dx);
    if (px <= 0) {
        return undefined;
    }
    const py = a.halfExtents.y + b.halfExtents.y - Math.abs(dy);
    if (py <= 0) {
        return undefined;
    }
    const pz = a.halfExtents.z + b.halfExtents.z - Math.abs(dz);
    if (pz <= 0) {
        return undefined;
    }
    if (px <= py && px <= pz) {
        return { normal: new Vector3(dx > 0 ? -1 : 1, 0, 0), depth: px };
    }
    if (py <= pz) {
        return { normal: new Vector3(0, dy > 0 ? -1 : 1, 0), depth: py };
    }
    return { normal: new Vector3(0, 0, dz > 0 ? -1 : 1), depth: pz };
}
export function collideBoxPlane(box, plane) {
    const { normal } = plane;
    box.center(center);
    plane.center(otherCenter);
    const reach = Math.abs(normal.x * box.halfExtents.x) + Math.abs(normal.y * box.halfExtents.y) + Math.abs(normal.z * box.halfExtents.z);
    const distance = normal.dot(center) - normal.dot(otherCenter);
    const depth = reach - distance;
    if (depth <= 0) {
        return undefined;
    }
    return { normal: normal.clone(), depth };
}
