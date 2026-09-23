import { Vector3 } from "../libs/math/vector3D";
import { AIR_DENSITY, GRAVITY } from "./constants";
export const STOP_SPEED = 0.05;
export function createVelocity({ velocity }) {
    return new Vector3(velocity?.x ?? 0, velocity?.y ?? 0, velocity?.z ?? 0);
}
export function createGravity({ gravity }) {
    return new Vector3(gravity?.x ?? 0, gravity?.y ?? GRAVITY, gravity?.z ?? 0);
}
export function massOf(body) {
    return body.weight > 0 ? body.weight : 1;
}
export function hasGravity(body) {
    return body.weight > 0 && !body.gravity.isNull;
}
export function applyForce(body, force, deltaTime) {
    if (body.weight > 0) {
        body.velocity.add(force, deltaTime / body.weight);
    }
}
export function airResistance(body, speed) {
    return (0.5 * AIR_DENSITY * body.area * speed * speed * body.damping) / massOf(body);
}
export function integrate(body, deltaTime, resistance) {
    const { velocity } = body;
    const half = deltaTime / 2;
    const gravity = hasGravity(body);
    if (gravity) {
        velocity.add(body.gravity, half);
    }
    if (velocity.isNull) {
        return;
    }
    const speed = velocity.magnitude;
    const lost = (resistance(speed) / speed) * deltaTime;
    if (lost > 0) {
        velocity.divide(1 + lost);
    }
    body.position.add(velocity, deltaTime);
    if (gravity) {
        velocity.add(body.gravity, half);
    }
    if (velocity.magnitude < STOP_SPEED) {
        velocity.set(0);
    }
}
