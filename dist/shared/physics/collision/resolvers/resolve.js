import { Vector3 } from "../../../libs/math/vector3D";
import { hasGravity } from "../../body";
export const SLOP = 0.01;
export const RESTITUTION_THRESHOLD = 1;
export const DEFAULT_MASS = 1;
export const MIN_SLIDE = 1e-6;
const relative = new Vector3();
const tangent = new Vector3();
export function inverseMass(collider) {
    const { entity, body } = collider;
    if (collider.isStatic || entity === undefined) {
        return 0;
    }
    if (body === undefined) {
        return 1 / DEFAULT_MASS;
    }
    return 1 / (body.weight > 0 ? body.weight : DEFAULT_MASS);
}
export function resolve(a, b, collision, options = {}) {
    const inverseA = inverseMass(a);
    const inverseB = inverseMass(b);
    const total = inverseA + inverseB;
    if (total === 0) {
        return;
    }
    const { normal, depth } = collision;
    separate(a, b, normal, depth, inverseA, inverseB, total);
    const velocityA = velocityOf(a);
    const velocityB = velocityOf(b);
    if (velocityA === undefined && velocityB === undefined) {
        return;
    }
    relative.set(velocityA ?? Vector3.NULL).subtract(velocityB ?? Vector3.NULL);
    const approach = relative.dot(normal);
    let support = 0;
    if (approach < 0) {
        const bounce = options.restitution ?? Math.max(a.restitution, b.restitution);
        const elasticity = -approach < RESTITUTION_THRESHOLD ? 0 : bounce;
        support = (-(1 + elasticity) * approach) / total;
        velocityA?.add(normal, support * inverseA);
        velocityB?.add(normal, -support * inverseB);
    }
    else {
        support = holding(a, b, normal, total, options.deltaTime ?? 0);
    }
    if (support <= 0) {
        return;
    }
    const friction = options.friction ?? Math.sqrt(a.friction * b.friction);
    if (friction <= 0) {
        return;
    }
    relative.set(velocityA ?? Vector3.NULL).subtract(velocityB ?? Vector3.NULL);
    tangent.set(relative).add(normal, -relative.dot(normal));
    const sliding = tangent.magnitude;
    if (sliding < MIN_SLIDE) {
        return;
    }
    tangent.scale(1 / sliding);
    const maximum = friction * support;
    const resistance = -Math.min(maximum, sliding / total);
    velocityA?.add(tangent, resistance * inverseA);
    velocityB?.add(tangent, -resistance * inverseB);
}
function holding(a, b, normal, total, deltaTime) {
    if (deltaTime <= 0) {
        return 0;
    }
    const gravity = gravityOf(a) ?? gravityOf(b);
    if (gravity === undefined) {
        return 0;
    }
    return (Math.abs(gravity.dot(normal)) * deltaTime) / total;
}
function velocityOf(collider) {
    const body = collider.body;
    return !collider.isStatic && body !== undefined ? body.velocity : undefined;
}
function gravityOf(collider) {
    const body = collider.body;
    return !collider.isStatic && body !== undefined && hasGravity(body) ? body.gravity : undefined;
}
function separate(a, b, normal, depth, inverseA, inverseB, total) {
    const correction = depth - SLOP;
    if (correction <= 0) {
        return;
    }
    a.entity?.position.add(normal, (correction * inverseA) / total);
    b.entity?.position.add(normal, (-correction * inverseB) / total);
}
