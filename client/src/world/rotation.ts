import type { BufferReader } from "@nasselk/binarypack";
import { Interpolator } from "../../../shared/libs/math/interpolation";
import { ObservableVector3, Vector3 } from "../../../shared/libs/math/vector3D";
import { FRAME, PositionEntity } from "./position";

export const SNAP_ANGLE = 0.0005;

export class RotationEntity extends PositionEntity {
	public readonly rotation: ObservableVector3;
	public readonly targetRotation: Vector3;

	public rotationInterpolation = true;
	public rotationSmoothing: number;

	public constructor(x: number = 0, y: number = 0, z: number = 0, pitch: number = 0, yaw: number = 0, roll: number = 0) {
		super(x, y, z);

		this.rotation = new ObservableVector3(pitch, yaw, roll);
		this.targetRotation = new Vector3(pitch, yaw, roll);
		this.rotationSmoothing = this.smoothing;
	}

	public get yaw(): number {
		return this.rotation.y;
	}

	public set yaw(value: number) {
		this.rotation.y = value;
	}

	public override deserialize(reader: BufferReader): void {
		super.deserialize(reader);

		this.readRotation(reader);
		this.rotation.set(this.targetRotation);
	}

	public override deserializeUpdate(reader: BufferReader): void {
		super.deserializeUpdate(reader);

		this.readRotation(reader);

		if (!this.rotationInterpolation) {
			this.rotation.set(this.targetRotation);
		}
	}

	public override update(deltaTime: number): void {
		super.update(deltaTime);

		if (!this.rotationInterpolation) {
			return;
		}

		const { rotation, targetRotation, rotationSmoothing } = this;
		const frames = deltaTime / FRAME;

		rotation.set(Interpolator.lerpAngle(rotation.x, targetRotation.x, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.y, targetRotation.y, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.z, targetRotation.z, rotationSmoothing, frames, SNAP_ANGLE));
	}

	protected readRotation(reader: BufferReader): void {
		const pitch = reader.readFloat32();
		const yaw = reader.readFloat32();
		const roll = reader.readFloat32();

		this.targetRotation.set(pitch, yaw, roll);
	}
}
