import { Entity as BaseEntity } from "../../../shared/world/entity";
export class Entity extends BaseEntity {
    constructor(world, context, _options = {}) {
        super(world, context);
    }
}
