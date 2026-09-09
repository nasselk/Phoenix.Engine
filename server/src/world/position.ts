import type { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import { Entity } from "./entity";

export const POSITION_EPSILON = 0.01;

export class PositionEntity extends Entity {
	public readonly position: ObservableVector3;

	public constructor(x: number = 0, y: number = 0, z: number = 0) {
		super();

		this.position = new ObservableVector3(x, y, z);
	}

	public override get isDirty(): boolean {
		return this.position.hasUpdated(POSITION_EPSILON);
	}

	public override clean(): void {
		this.position.store();
	}

	public override serialize(writer: BufferWriter): void {
		this.writePosition(writer);
	}

	public override serializeUpdate(writer: BufferWriter): void {
		this.writePosition(writer);
	}

	protected writePosition(writer: BufferWriter): void {
		const { position } = this;

		writer.writeFloat32(position.x);
		writer.writeFloat32(position.y);
		writer.writeFloat32(position.z);
	}
}
