import type { ColliderDesc, RigidBody, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { PositionEntity, type PositionEntityOptions } from "./position";
import type { World } from "../world";

type VectorOptions = { readonly x?: number; readonly y?: number; readonly z?: number };

export type MovingEntityOptions = PositionEntityOptions & {
	/** Units per second it starts out moving at. */
	readonly velocity?: VectorOptions;
	/** How hard the room's gravity pulls it: 1 falls, 0 floats, 2 falls twice as hard. */
	readonly gravityScale?: number;
	/** The share of its speed it loses to the air each second. 0 is a vacuum. */
	readonly damping?: number;
};

export abstract class MovingEntity<C> extends PositionEntity<C> {
	/** Held until the body exists, which is when they are applied. */
	private readonly initial: MovingEntityOptions;

	public constructor(world: World<any, any>, context: C, options: MovingEntityOptions = {}) {
		super(world, context, options);

		this.initial = options;
	}

	/** The body gets what the options asked for — gravity, air, a starting velocity — as it is made. */
	protected override embody(body: RigidBodyDesc, ...shapes: readonly ColliderDesc[]): RigidBody {
		const { velocity, gravityScale, damping } = this.initial;

		body.setGravityScale(gravityScale ?? 1)
			.setLinearDamping(damping ?? 0)
			.setLinvel(velocity?.x ?? 0, velocity?.y ?? 0, velocity?.z ?? 0);

		return super.embody(body, ...shapes);
	}

	/** A kick, in mass times units per second: the heavier it is, the less the same one moves it. */
	public applyImpulse(x: number, y: number, z: number): this {
		this.body?.applyImpulse({ x, y, z }, true);

		return this;
	}

	/** Nothing of its own: the physics moves it. A subclass puts what it decides here, like a player's input. */
	public update(_deltaTime: number): void {}
}
