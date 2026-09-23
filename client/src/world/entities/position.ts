import { BufferReader } from "@nasselk/binarypack";
import { Interpolator } from "../../../../shared/libs/math/interpolation";
import { Vector3 } from "../../../../shared/libs/math/vector3D";
import { Group } from "three";
import type { EntityOptions } from "../../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "../world";

export type PositionEntityOptions = EntityOptions & {
	readonly x?: number;
	readonly y?: number;
	readonly z?: number;
	readonly pitch?: number;
	readonly yaw?: number;
	readonly roll?: number;
};

export abstract class PositionEntity<C> extends Entity<C> {
	private static readonly FRAMES_PER_SECOND = 60;
	private static readonly DEFAULT_SMOOTHING = 0.25;
	private static readonly SNAP_DISTANCE = 0.001;
	private static readonly SNAP_ANGLE = 0.0005;

	public readonly position: Vector3;
	public readonly targetPosition: Vector3;

	public readonly rotation: Vector3;
	public readonly targetRotation: Vector3;

	/**
	 * This entity in the scene. What it draws goes in as children, placed in its local space, and
	 * follows its position and rotation. Added to the world's group on spawn and taken out on destroy.
	 */
	public readonly group: Group;

	public positionSmoothing = true;
	public smoothing = PositionEntity.DEFAULT_SMOOTHING;

	public rotationInterpolation = true;
	public rotationSmoothing = PositionEntity.DEFAULT_SMOOTHING;

	public constructor(world: World<any, any>, context: C, options: PositionEntityOptions = {}) {
		super(world, context, options);

		this.position = new Vector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
		this.targetPosition = this.position.clone();
		this.rotation = new Vector3(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
		this.targetRotation = this.rotation.clone();

		this.group = new Group();

		this.group.rotation.order = "YXZ";
		this.group.userData.entity = this;

		this.syncGroup();
	}

	public override onSpawn(): void {
		this.syncGroup();

		this.world.group.add(this.group);
	}

	public override onDestroy(): void {
		this.group.removeFromParent();
	}

	public override update(deltaTime: number): void {
		const { FRAMES_PER_SECOND, SNAP_DISTANCE, SNAP_ANGLE } = PositionEntity;

		const frames = deltaTime * FRAMES_PER_SECOND;

		if (this.positionSmoothing) {
			const { position, targetPosition, smoothing } = this;

			position.set(Interpolator.lerp(position.x, targetPosition.x, smoothing, frames, SNAP_DISTANCE), Interpolator.lerp(position.y, targetPosition.y, smoothing, frames, SNAP_DISTANCE), Interpolator.lerp(position.z, targetPosition.z, smoothing, frames, SNAP_DISTANCE));
		} else {
			this.position.set(this.targetPosition);
		}

		if (this.rotationInterpolation) {
			const { rotation, targetRotation, rotationSmoothing } = this;

			rotation.set(Interpolator.lerpAngle(rotation.x, targetRotation.x, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.y, targetRotation.y, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.z, targetRotation.z, rotationSmoothing, frames, SNAP_ANGLE));
		} else {
			this.rotation.set(this.targetRotation);
		}

		this.syncGroup();
	}

	/** Put `group` where the entity is. Every update ends with it; one that replaces this update's must call it too. */
	protected syncGroup(): void {
		const { position, rotation, group } = this;

		group.position.set(position.x, position.y, position.z);
		group.rotation.set(rotation.x, rotation.y, rotation.z);
	}

	public override deserialize(reader: BufferReader): void {
		const x = reader.readFloat32();
		const y = reader.readFloat32();
		const z = reader.readFloat32();

		this.targetPosition.set(x, y, z);

		const pitch = reader.readFloat32();
		const yaw = reader.readFloat32();
		const roll = reader.readFloat32();

		this.targetRotation.set(pitch, yaw, roll);

		this.position.set(this.targetPosition);
		this.rotation.set(this.targetRotation);
	}

	public override deserializeUpdate(reader: BufferReader): void {
		const px = reader.readBoolean();
		const py = reader.readBoolean();
		const pz = reader.readBoolean();
		const rx = reader.readBoolean();
		const ry = reader.readBoolean();
		const rz = reader.readBoolean();

		const { targetPosition, targetRotation } = this;

		if (px) {
			targetPosition.x = reader.readFloat32();
		}

		if (py) {
			targetPosition.y = reader.readFloat32();
		}

		if (pz) {
			targetPosition.z = reader.readFloat32();
		}

		if (rx) {
			const rotation = reader.readFloat32();

			targetRotation.x = BufferReader.fromPrecision(rotation, 2 * Math.PI, 8);
		}

		if (ry) {
			const rotation = reader.readFloat32();

			targetRotation.y = BufferReader.fromPrecision(rotation, 2 * Math.PI, 8);
		}

		if (rz) {
			const rotation = reader.readFloat32();

			targetRotation.y = BufferReader.fromPrecision(rotation, 2 * Math.PI, 8);
		}
	}
}
