import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import { Entity } from "./entity";
export const POSITION_EPSILON = 0.01;
export class PositionEntity extends Entity {
    constructor(x = 0, y = 0, z = 0) {
        super();
        this.position = new ObservableVector3(x, y, z);
    }
    get isDirty() {
        return this.position.hasUpdated(POSITION_EPSILON);
    }
    clean() {
        this.position.store();
    }
    serialize(writer) {
        this.writePosition(writer);
    }
    serializeUpdate(writer) {
        this.writePosition(writer);
    }
    writePosition(writer) {
        const { position } = this;
        writer.writeFloat32(position.x);
        writer.writeFloat32(position.y);
        writer.writeFloat32(position.z);
    }
}
