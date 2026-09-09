import type { BufferReader } from "@nasselk/binarypack";
import { Entity as BaseEntity } from "../../../shared/world/entity";

export abstract class Entity extends BaseEntity {
	public abstract deserialize(_reader: BufferReader): void;

	public abstract deserializeUpdate(_reader: BufferReader): void;
}
