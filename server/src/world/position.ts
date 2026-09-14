import type { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import type { Collider } from "./collision/colliders/collider";
import type { Engine } from "..";
import type { EntityOptions } from "../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "./world";

export const POSITION_EPSILON = 0.01;

export const ROTATION_EPSILON = 0.01;

export type PositionEntityOptions = EntityOptions & {
	readonly x?: number;
	readonly y?: number;
	readonly z?: number;
	readonly pitch?: number;
	readonly yaw?: number;
	readonly roll?: number;
};

export abstract class PositionEntity<C = Engine> extends Entity<C> {
	public readonly position: ObservableVector3;

	public readonly rotation: ObservableVector3;

	public collider?: Collider;

	public constructor(world: World<any, any>, context: C, options: PositionEntityOptions = {}) {
		super(world, context, options);

		this.position = new ObservableVector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
		this.rotation = new ObservableVector3(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
	}

	public get yaw(): number {
		return this.rotation.y;
	}

	public set yaw(value: number) {
		this.rotation.y = value;
	}

	public override get isDirty(): boolean {
		return this.position.hasUpdated(POSITION_EPSILON) || this.rotation.hasUpdated(ROTATION_EPSILON);
	}

	public override clean(): void {
		this.position.store();
		this.rotation.store();
	}

	public override serialize(writer: BufferWriter): void {
		this.writeTransforms(writer);
	}

	public override serializeUpdate(writer: BufferWriter): void {
		const { position, rotation } = this;

		const px = position.hasUpdatedX(POSITION_EPSILON);
		const py = position.hasUpdatedY(POSITION_EPSILON);
		const pz = position.hasUpdatedZ(POSITION_EPSILON);
		const rx = rotation.hasUpdatedX(ROTATION_EPSILON);
		const ry = rotation.hasUpdatedY(ROTATION_EPSILON);
		const rz = rotation.hasUpdatedZ(ROTATION_EPSILON);

		writer.writeBoolean(px);
		writer.writeBoolean(py);
		writer.writeBoolean(pz);
		writer.writeBoolean(rx);
		writer.writeBoolean(ry);
		writer.writeBoolean(rz);

		if (px) {
			writer.writeFloat32(position.x);
		}

		if (py) {
			writer.writeFloat32(position.y);
		}

		if (pz) {
			writer.writeFloat32(position.z);
		}

		if (rx) {
			writer.writeFloat32(rotation.x);
		}

		if (ry) {
			writer.writeFloat32(rotation.y);
		}

		if (rz) {
			writer.writeFloat32(rotation.z);
		}
	}

	protected writeTransforms(writer: BufferWriter): void {
		const { position, rotation } = this;

		writer.writeFloat32(position.x);
		writer.writeFloat32(position.y);
		writer.writeFloat32(position.z);

		writer.writeFloat32(rotation.x);
		writer.writeFloat32(rotation.y);
		writer.writeFloat32(rotation.z);
	}
}
