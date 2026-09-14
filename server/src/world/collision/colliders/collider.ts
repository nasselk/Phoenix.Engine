import { Vector3 } from "../../../../../shared/libs/math/vector3D";
import type { PositionEntity } from "../../position";
import { collide } from "../resolvers/collide";
import { resolve, type ResolveOptions } from "../resolvers/resolve";
import type { ColliderKind, Collision } from "../kind";

export abstract class Collider {
	public abstract readonly kind: ColliderKind;

	public entity?: PositionEntity<any>;

	public readonly offset = new Vector3();

	public isStatic = false;

	/** 0 stops dead, 1 gives all the speed back. The bouncier of the two surfaces wins a collision. */
	public restitution = 0;

	/**
	 * How hard this surface resists something sliding along it, combined with the other surface as
	 * the geometric mean so either one can be the slippery one. 0 is frictionless ice, 1 is rubber.
	 *
	 * It only bites while the two are touching, and only as hard as the contact is loaded — which is
	 * why a resolve that wants a resting crate to slow down has to be told the tick's deltaTime.
	 */
	public friction = 0;

	public enabled = true;

	public attach(entity: PositionEntity<any>): this {
		this.entity = entity;
		entity.collider = this;

		return this;
	}

	public detach(): this {
		if (this.entity?.collider === this) {
			this.entity.collider = undefined;
		}

		this.entity = undefined;

		return this;
	}

	public center(out: Vector3 = new Vector3()): Vector3 {
		const { entity, offset } = this;

		if (entity === undefined) {
			return out.set(offset);
		}

		return out.set(entity.position).add(offset);
	}

	public collide(other: Collider | PositionEntity<any>): Collision | undefined {
		const collider = other instanceof Collider ? other : other.collider;

		if (collider === undefined || collider === this || !this.enabled || !collider.enabled) {
			return undefined;
		}

		return collide(this, collider);
	}

	public intersects(other: Collider | PositionEntity<any>): boolean {
		return this.collide(other) !== undefined;
	}

	/** Push apart and trade the impulse: the bounce and the slide, off both entities' weights. */
	public resolve(other: Collider | PositionEntity<any>, options?: ResolveOptions): Collision | undefined {
		const collider = other instanceof Collider ? other : other.collider;
		const collision = this.collide(collider ?? this);

		if (collision !== undefined && collider !== undefined) {
			resolve(this, collider, collision, options);
		}

		return collision;
	}

	public separate(other: Collider | PositionEntity<any>): Collision | undefined {
		const collision = this.collide(other);
		const entity = this.entity;

		if (collision === undefined || entity === undefined || this.isStatic) {
			return collision;
		}

		entity.position.add(collision.normal, collision.depth);

		return collision;
	}
}
