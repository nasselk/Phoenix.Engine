import { Vector3 } from "../../../shared/libs/math/vector3D";
import { GRAVITY } from "../../../shared/world/physics";
import { PositionEntity } from "./position";

export class MovingEntity extends PositionEntity {
	public readonly velocity = new Vector3();

	public weight = 0;

	public readonly gravity = new Vector3(0, GRAVITY, 0);

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
			this.velocity.add(force, deltaTime / 1000 / this.weight);
		}

		return this;
	}

	public override update(deltaTime: number): void {
		const seconds = deltaTime / 1000;

		if (this.hasGravity) {
			this.velocity.add(this.gravity, seconds);
		}

		if (this.velocity.isNull) {
			return;
		}

		this.position.add(this.velocity, seconds);
	}
}
