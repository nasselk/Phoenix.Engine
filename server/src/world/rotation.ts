import type { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import { PositionEntity } from "./position";

export const ROTATION_EPSILON = 0.01;

export class RotationEntity extends PositionEntity {
	public readonly rotation: ObservableVector3;

	public constructor(x: number = 0, y: number = 0, z: number = 0, pitch: number = 0, yaw: number = 0, roll: number = 0) {
		super(x, y, z);

		this.rotation = new ObservableVector3(pitch, yaw, roll);
	}

	public get yaw(): number {
		return this.rotation.y;
	}

	public set yaw(value: number) {
		this.rotation.y = value;
	}

	public override get isDirty(): boolean {
		return super.isDirty || this.rotation.hasUpdated(ROTATION_EPSILON);
	}

	public override clean(): void {
		super.clean();

		this.rotation.store();
	}

	public override serialize(writer: BufferWriter): void {
		super.serialize(writer);

		this.writeRotation(writer);
	}

	public override serializeUpdate(writer: BufferWriter): void {
		super.serializeUpdate(writer);

		this.writeRotation(writer);
	}

	protected writeRotation(writer: BufferWriter): void {
		const { rotation } = this;

		writer.writeFloat32(rotation.x);
		writer.writeFloat32(rotation.y);
		writer.writeFloat32(rotation.z);
	}
}
