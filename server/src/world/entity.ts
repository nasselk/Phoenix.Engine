import type { BufferWriter } from "@nasselk/binarypack";
import { Entity as BaseEntity } from "../../../shared/world/entity";

export abstract class Entity extends BaseEntity {
	public abstract serialize(_writer: BufferWriter): void;

	public abstract serializeUpdate(_writer: BufferWriter): void;

	public get isDirty(): boolean {
		return false;
	}

	public clean(): void {}
}
