import { Entity as BaseEntity } from "../../../../shared/world/entity";
import { Slot } from "../replication";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50aXR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc2VydmVyL3NyYy93b3JsZC9lbnRpdGllcy9lbnRpdHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLE1BQU0sSUFBSSxVQUFVLEVBQXNCLE1BQU0saUNBQWlDLENBQUM7QUFDM0YsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBSXRDLE1BQU0sT0FBZ0IsTUFBVSxTQUFRLFVBQWE7SUFJcEQsWUFBbUIsS0FBc0IsRUFBRSxPQUFVLEVBQUUsUUFBUSxHQUFrQixFQUFFO1FBQ2xGLEtBQUssQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFdEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFNRCxJQUFXLE9BQU87UUFDakIsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRU0sS0FBSyxLQUFVLENBQUM7Q0FDdkIifQ==