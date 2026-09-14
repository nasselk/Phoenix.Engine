import { Vector3 } from "../../../shared/libs/math/vector3D";
import { AIR_DENSITY, GRAVITY } from "../../../shared/world/physics";
import { PositionEntity } from "./position";
export const MIN_SPEED = 0.05;
export class MovingEntity extends PositionEntity {
    constructor() {
        super(...arguments);
        this.velocity = new Vector3();
        this.weight = 0;
        this.damping = 1;
        this.gravity = new Vector3(0, GRAVITY, 0);
    }
    get area() {
        return 1;
    }
    get mass() {
        return this.weight > 0 ? this.weight : 1;
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
            this.velocity.add(force, deltaTime / this.weight);
        }
        return this;
    }
    resistance(speed) {
        return (0.5 * AIR_DENSITY * this.area * speed * speed * this.damping) / this.mass;
    }
    update(deltaTime) {
        const half = deltaTime / 2;
        const gravity = this.hasGravity;
        if (gravity) {
            this.velocity.add(this.gravity, half);
        }
        if (this.velocity.isNull) {
            return;
        }
        const speed = this.velocity.magnitude;
        const lost = (this.resistance(speed) / speed) * deltaTime;
        if (lost > 0) {
            this.velocity.divide(1 + lost);
        }
        this.position.add(this.velocity, deltaTime);
        if (gravity) {
            this.velocity.add(this.gravity, half);
        }
        if (this.velocity.magnitude < MIN_SPEED) {
            this.velocity.set(0);
        }
    }
}
