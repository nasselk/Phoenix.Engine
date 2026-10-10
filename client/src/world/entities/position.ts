import { BufferReader } from "@nasselk/binarypack";
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
	public readonly position: Vector3;
	public readonly targetPosition: Vector3;

	public readonly rotation: Quaternion;
	public readonly targetRotation: Quaternion;

	/**
	 * This entity in the scene. What it draws goes in as children, placed in its local space, and
	 * follows its position and rotation. Added to the world's group on spawn and taken out on destroy.
	 */
	public readonly group: Group;

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
		this.updatePosition(deltaTime);
		this.updateRotation(deltaTime);
		this.syncGroup();
	}

	/** Bring the shown `position` to what the server said, `targetPosition`. By default it jumps there; override it to interpolate. */
	protected updatePosition(deltaTime: number): void {
		this.position.set(this.targetPosition);
	}

	/** Bring the shown `rotation` to what the server said, `targetRotation`. By default it jumps there; override it to interpolate. */
	protected updateRotation(deltaTime: number): void {
		this.rotation.set(this.targetRotation);
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
