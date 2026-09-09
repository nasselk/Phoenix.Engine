import { Entity as BaseEntity } from "../../../shared/world/entity";
export class Entity extends BaseEntity {
    get isDirty() {
        return false;
    }
    clean() { }
}
