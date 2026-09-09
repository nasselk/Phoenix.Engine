import type { BufferReader } from "@nasselk/binarypack";
import { Entity as BaseEntity } from "../../../shared/world/entity";
export declare abstract class Entity extends BaseEntity {
    abstract deserialize(_reader: BufferReader): void;
    abstract deserializeUpdate(_reader: BufferReader): void;
}
