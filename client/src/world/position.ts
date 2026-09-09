import type { BufferReader } from "@nasselk/binarypack";
import { Interpolator } from "../../../shared/libs/math/interpolation";
import { ObservableVector3, Vector3 } from "../../../shared/libs/math/vector3D";
import { Entity } from "./entity";

export const FRAME = 1000 / 60;

export const DEFAULT_SMOOTHING = 0.25;

export const SNAP_DISTANCE = 0.001;

export class PositionEntity extends Entity {
	public readonly position: ObservableVector3;
	public readonly targetPosition: Vector3;

	public interpolation = true;
	public smoothing = DEFAULT_SMOOTHING;

	public constructor(x: number = 0, y: number = 0, z: number = 0) {
		super();

		this.position = new ObservableVector3(x, y, z);
		this.targetPosition = new Vector3(x, y, z);
	}

	public override deserialize(reader: BufferReader): void {
		this.readPosition(reader);
		this.position.set(this.targetPosition);
	}

	public override deserializeUpdate(reader: BufferReader): void {
		this.readPosition(reader);

		if (!this.interpolation) {
			this.position.set(this.targetPosition);
		}
	}

	public override update(deltaTime: number): void {
		if (!this.interpolation) {
			return;
		}

		const { position, targetPosition, smoothing } = this;
		const frames = deltaTime / FRAME;

		position.set(Interpolator.lerp(position.x, targetPosition.x, smoothing, frames, SNAP_DISTANCE), Interpolator.lerp(position.y, targetPosition.y, smoothing, frames, SNAP_DISTANCE), Interpolator.lerp(position.z, targetPosition.z, smoothing, frames, SNAP_DISTANCE));
	}

	protected readPosition(reader: BufferReader): void {
		const x = reader.readFloat32();
		const y = reader.readFloat32();
		const z = reader.readFloat32();

		this.targetPosition.set(x, y, z);
	}
}
