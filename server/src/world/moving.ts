import { Vector3 } from "../../../shared/libs/math/vector3D";
import { AIR_DENSITY, GRAVITY } from "../../../shared/world/physics";
import type { Engine } from "..";
import { PositionEntity } from "./position";

export const MIN_SPEED = 0.05;

export abstract class MovingEntity<C = Engine> extends PositionEntity<C> {
	public readonly velocity = new Vector3();

	public weight = 0;

	public damping = 1;

	/** Frontal area the air sees, in square units. Override it on anything that is not 1×1. */
	public get area(): number {
		return 1;
	}

	public readonly gravity = new Vector3(0, GRAVITY, 0);

	/** What forces are divided by. A weightless entity still has to weigh something to be pushed. */
	public get mass(): number {
		return this.weight > 0 ? this.weight : 1;
	}

	public get speed(): number {
		return this.velocity.magnitude;
	}

	public get isMoving(): boolean {
		return !this.velocity.isNull;
	}

	public get hasGravity(): boolean {
		return this.weight > 0 && !this.gravity.isNull;
	}

	public stop(): this {
		this.velocity.set(0, 0, 0);

		return this;
	}

	public applyForce(force: Vector3, deltaTime: number): this {
		if (this.weight > 0) {
			this.velocity.add(force, deltaTime / this.weight);
		}

		return this;
	}

	/**
	 * How much speed this entity loses per second at a given speed.
	 *
	 * One place, so a game that wants a different law — true air resistance, a drag that thins with
	 * altitude, a boat that only resists sideways — overrides this and nothing else changes.
	 */
	protected resistance(speed: number): number {
		return (0.5 * AIR_DENSITY * this.area * speed * speed * this.damping) / this.mass;
	}

	public update(deltaTime: number): void {
		const half = deltaTime / 2;
		const gravity = this.hasGravity;

		if (gravity) {
			this.velocity.add(this.gravity, half);
		}

		if (this.velocity.isNull) {
			return;
		}

		const speed = this.velocity.magnitude;
		// The fraction of its speed the air would take at this speed, over this tick.
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
