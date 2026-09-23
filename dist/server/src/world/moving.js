import { Vector3 } from "../../../shared/libs/math/vector3D";
import { PositionEntity } from "./position";
export class MovingEntity extends PositionEntity {
    constructor(world, context, options = {}) {
        super(world, context, options);
        this.current = new Vector3();
        this.initial = options;
    }
    embody(body, shapes) {
        const { velocity, gravityScale, damping } = this.initial;
        body.setGravityScale(gravityScale ?? 1)
            .setLinearDamping(damping ?? 0)
            .setLinvel(velocity?.x ?? 0, velocity?.y ?? 0, velocity?.z ?? 0);
        return super.embody(body, shapes);
    }
    get velocity() {
        return this.body === undefined ? this.current.set(0, 0, 0) : this.body.linvel(this.current);
    }
    setVelocity(x, y, z) {
        this.body?.setLinvel({ x, y, z }, true);
        return this;
    }
    applyImpulse(x, y, z) {
        this.body?.applyImpulse({ x, y, z }, true);
        return this;
    }
    update(_deltaTime) { }
}
