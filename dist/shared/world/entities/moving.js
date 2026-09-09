import { Vector3 } from "../../libs/math/vector3D";
import { PositionEntity } from "./position";
export class MovingEntity extends PositionEntity {
    constructor() {
        super(...arguments);
        this.velocity = new Vector3();
    }
    get speed() {
        return this.velocity.magnitude;
    }
    get isMoving() {
        return !this.velocity.isNull;
    }
    stop() {
        this.velocity.set(0, 0, 0);
        return this;
    }
    update(deltaTime) {
        if (this.velocity.isNull) {
            return;
        }
        this.position.add(this.velocity, deltaTime / 1000);
    }
}
