import { Vector3 } from "../../../../../shared/libs/math/vector3D";
import { MovingEntity } from "../../moving";
import type { Collider } from "../colliders/collider";
import type { Collision } from "../kind";

export const SLOP = 0.01;

export const RESTITUTION_THRESHOLD = 1;

export const DEFAULT_MASS = 1;

/**
 * Below this, a slide is not a slide. Guarding on the length rather than on "is it exactly zero"
 * because two velocities that nearly cancel leave a residue small enough that squaring it underflows
 * to zero — and then normalising it is a division by zero.
 */
export const MIN_SLIDE = 1e-6;

export type ResolveOptions = {
	/** Overrides the pair's combined bounce for this one call. */
	readonly restitution?: number;
	/** Overrides the pair's combined friction for this one call. */
	readonly friction?: number;
	/**
	 * Seconds since the last tick. Without it a contact that is merely resting — a crate sitting on
	 * the ground rather than landing on it — has no impulse for friction to bite on, and nothing
	 * slows down. Pass the tick's deltaTime and sliding costs speed.
	 */
	readonly deltaTime?: number;
};

const relative = new Vector3();
const tangent = new Vector3();

export function inverseMass(collider: Collider): number {
	const entity = collider.entity;

	if (collider.isStatic || entity === undefined) {
		return 0;
	}

	if (!(entity instanceof MovingEntity)) {
		return 1 / DEFAULT_MASS;
	}

	return 1 / (entity.weight > 0 ? entity.weight : DEFAULT_MASS);
}

export function resolve(a: Collider, b: Collider, collision: Collision, options: ResolveOptions = {}): void {
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
	} else {
		// Resting on it rather than hitting it: the contact is still carrying this thing's weight,
		// and that is the force friction gets to work against.
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
	// Never more than it takes to stop the slide: friction slows things, it does not reverse them.
	const resistance = -Math.min(maximum, sliding / total);

	velocityA?.add(tangent, resistance * inverseA);
	velocityB?.add(tangent, -resistance * inverseB);
}

/** The impulse this contact spends each tick holding the pair up against gravity. */
function holding(a: Collider, b: Collider, normal: Vector3, total: number, deltaTime: number): number {
	if (deltaTime <= 0) {
		return 0;
	}

	const gravity = gravityOf(a) ?? gravityOf(b);

	if (gravity === undefined) {
		return 0;
	}

	return (Math.abs(gravity.dot(normal)) * deltaTime) / total;
}

function velocityOf(collider: Collider): Vector3 | undefined {
	const entity = collider.entity;

	return !collider.isStatic && entity instanceof MovingEntity ? entity.velocity : undefined;
}

function gravityOf(collider: Collider): Vector3 | undefined {
	const entity = collider.entity;

	return !collider.isStatic && entity instanceof MovingEntity && entity.hasGravity ? entity.gravity : undefined;
}

function separate(a: Collider, b: Collider, normal: Vector3, depth: number, inverseA: number, inverseB: number, total: number): void {
	const correction = depth - SLOP;

	if (correction <= 0) {
		return;
	}

	a.entity?.position.add(normal, (correction * inverseA) / total);
	b.entity?.position.add(normal, (-correction * inverseB) / total);
}
