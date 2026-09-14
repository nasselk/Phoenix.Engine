import { Entity as BaseEntity } from "../../../shared/world/entity";
export class Entity extends BaseEntity {
    constructor(world, context, group, _options = {}) {
        super(world, context);
        this.group = group;
    }
}
