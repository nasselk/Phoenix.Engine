import { Vector3 } from "../../../shared/libs/math/vector3D";
import { GRAVITY } from "../../../shared/world/physics";
import { PositionEntity } from "./position";
export class MovingEntity extends PositionEntity {
    constructor() {
        super(...arguments);
        this.velocity = new Vector3();
        this.weight = 0;
        this.gravity = new Vector3(0, GRAVITY, 0);
    }
    get speed() {
        return this.velocity.magnitude;
    }
    get isMoving() {
        return !this.velocity.isNull;
    }
    get hasGravity() {
        return this.weight > 0 && !this.gravity.isNull;
    }
    stop() {
        this.velocity.set(0, 0, 0);
        return this;
    }
    applyForce(force, deltaTime) {
        if (this.weight > 0) {
            this.velocity.add(force, deltaTime / 1000 / this.weight);
        }
        return this;
    }
    update(deltaTime) {
        const seconds = deltaTime / 1000;
        if (this.hasGravity) {
            this.velocity.add(this.gravity, seconds);
        }
        if (this.velocity.isNull) {
            return;
        }
        this.position.add(this.velocity, seconds);
    }
}
