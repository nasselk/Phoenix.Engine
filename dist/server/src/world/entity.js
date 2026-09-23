import { Entity as BaseEntity } from "../../../shared/world/entity";
import { Slot } from "./replication";
export class Entity extends BaseEntity {
    constructor(world, context, _options = {}) {
        super(world, context);
        this.slot = new Slot();
    }
    get isDirty() {
        return false;
    }
    clean() { }
}
