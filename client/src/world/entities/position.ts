import { BufferReader } from "@nasselk/binarypack";
import { Interpolator } from "../../../../shared/math/interpolation";
import { Vector3 } from "../../../../shared/math/vector3";
import { Quaternion } from "../../../../shared/math/quaternion";
import { Group, Vector3Like } from "three";
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

	public readonly rotation: Quaternion;
	public readonly targetRotation: Quaternion;

	/**
	 * This entity in the scene. What it draws goes in as children, placed in its local space, and
	 * follows its position and rotation. Added to the world's group on spawn and taken out on destroy.
	 */
	public readonly group: Group;

	/** Ease toward the server's position. Off, the entity snaps to it every frame. */
	public smoothPosition = true;
	/** The share of the remaining gap closed per 60 Hz frame, scaled to the real frame time. */
	public positionSmoothing = PositionEntity.DEFAULT_SMOOTHING;

	/** Turn toward the server's rotation along the shortest arc. Off, the entity snaps to it every frame. */
	public smoothRotation = true;
	/** The share of the remaining turn made per 60 Hz frame, scaled to the real frame time. */
	public rotationSmoothing = PositionEntity.DEFAULT_SMOOTHING;

	public constructor(world: World<any, any>, context: C, options: PositionEntityOptions = {}) {
		super(world, context, options);

		this.position = new Vector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
		this.targetPosition = this.position.clone();
		this.rotation = new Quaternion().setFromEuler(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
		this.targetRotation = this.rotation.clone();

		this.group = new Group();

		this.group.rotation.order = "YXZ";
		this.group.userData.entity = this;
	}

	public override onSpawn(): void {
		this.syncGroup();

		this.world.group.add(this.group);
	}

	public override onDestroy(): void {
		this.group.removeFromParent();
	}

	public teleport(position: Vector3Like): void;
	public teleport(x: number, y: number, z: number): void;
	public teleport(a: number | Vector3Like, b?: number, c?: number): void {
		if (typeof a === "number") {
			this.targetPosition.set(a, b, c);
			this.position.set(a, b, c);
		} else {
			this.targetPosition.set(a);
			this.position.set(a);
		}
	}

	public override update(deltaTime: number): void {
		const { FRAMES_PER_SECOND, SNAP_DISTANCE, SNAP_ANGLE } = PositionEntity;

		const frames = deltaTime * FRAMES_PER_SECOND;

		if (this.smoothPosition) {
			const { position, targetPosition, positionSmoothing } = this;

			Interpolator.lerpVector(position, targetPosition, positionSmoothing, frames, SNAP_DISTANCE);
		} else {
			this.teleport(this.targetPosition);
		}

		if (this.smoothRotation) {
			const { rotation, targetRotation, rotationSmoothing } = this;

			Interpolator.slerpQuaternion(rotation, targetRotation, rotationSmoothing, frames, SNAP_ANGLE);
		} else {
			this.rotation.set(this.targetRotation);
		}

		this.syncGroup();
	}

	/** Put `group` where the entity is. Every update ends with it; one that replaces this update's must call it too. */
	protected syncGroup(): void {
		const { position, rotation, group } = this;

		group.position.set(position.x, position.y, position.z);
		group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
	}

	public override deserialize(reader: BufferReader): void {
		const x = reader.readFloat32();
		const y = reader.readFloat32();
		const z = reader.readFloat32();

		this.targetPosition.set(x, y, z);
		this.targetRotation.unpack(reader.readUint32());

		this.position.set(this.targetPosition);
		this.rotation.set(this.targetRotation);
	}

	public override deserializeUpdate(reader: BufferReader): void {
		const px = reader.readBoolean();
		const py = reader.readBoolean();
		const pz = reader.readBoolean();
		const turned = reader.readBoolean();

		const { targetPosition } = this;

		if (px) {
			targetPosition.x = reader.readFloat32();
		}

		if (py) {
			targetPosition.y = reader.readFloat32();
		}

		if (pz) {
			targetPosition.z = reader.readFloat32();
		}

		if (turned) {
			this.targetRotation.unpack(reader.readUint32());
		}
	}

	/** Which way it faces on the ground. */
	public get yaw(): number {
		return this.rotation.yaw;
	}
}
