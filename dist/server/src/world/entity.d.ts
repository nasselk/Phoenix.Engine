import type { BufferWriter } from "@nasselk/binarypack";
import { Entity as BaseEntity } from "../../../shared/world/entity";
export declare abstract class Entity extends BaseEntity {
    abstract serialize(_writer: BufferWriter): void;
    abstract serializeUpdate(_writer: BufferWriter): void;
    get isDirty(): boolean;
    clean(): void;
}
