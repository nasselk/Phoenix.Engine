import { Vector3 } from "../../../shared/libs/math/vector3D";
import { AIR_DENSITY, GRAVITY } from "../../../shared/world/physics";
import type { Engine } from "..";
import { PositionEntity } from "./position";

export const STOP_SPEED = 0.05;

export abstract class MovingEntity<C = Engine, G = unknown> extends PositionEntity<C, G> {
	public readonly velocity = new Vector3();

	public override positionSmoothing = false;

	public weight = 0;

	/**
	 * How hard the air bites, as the Cd in `a = ½ · density · speed² · Cd · area / mass`.
	 *
	 * 1 is a blunt object at real air density and the default, so an entity that is told nothing
	 * falls the way a brick does. It doubles as the feel knob because a drag coefficient and a
	 * tuning multiplier are the same thing sitting in the same place: 0 is vacuum, 0.47 a sphere,
	 * 1.05 a cube, 1.5 a parachute, 10 something wading through treacle.
	 *
	 * Everything interesting follows from the formula rather than from a number anyone picked: a
	 * heavy thing barely notices the air, a big light one flutters, and terminal velocity is
	 * wherever this cancels gravity.
	 */
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

	/**
	 * One tick of velocity Verlet, in its kick-drift-kick form: half the acceleration, move, then
	 * the other half.
	 *
	 *   v += a · dt/2        (kick)
	 *   x += v · dt          (drift)
	 *   v += a · dt/2        (kick)
	 *
	 * Splitting the kick is what makes it second order. The drift uses a velocity that is already
	 * half a tick old, so the distance covered works out to `v·dt + ½·a·dt²` — the exact parabola a
	 * constant acceleration draws, rather than the slightly short one a single kick gives. A jump
	 * reaches the height the numbers say it should, and it reaches the same height at 20 ticks a
	 * second as at 240.
	 *
	 * Resistance sits between the kicks rather than being folded into the acceleration, because it
	 * is solved exactly over the tick instead of sampled — see {@link resistance}.
	 */
	public override update(deltaTime: number): void {
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
			// `1 / (1 + lost)` rather than `1 - lost`, which is what the same thing looks like before
			// the maths is finished: it is the exact solution of `dv/dt = -k v²` over the tick, so the
			// answer does not drift with the tick rate, and it can never overshoot into going
			// backwards however long the tick or however thick the air.
			this.velocity.divide(1 + lost);
		}

		this.position.add(this.velocity, deltaTime);

		if (gravity) {
			this.velocity.add(this.gravity, half);
		}

		if (this.velocity.magnitude < STOP_SPEED) {
			this.velocity.set(0);
		}
	}
}
