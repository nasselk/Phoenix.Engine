import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import { PositionEntity } from "./position";
export const ROTATION_EPSILON = 0.01;
export class RotationEntity extends PositionEntity {
    constructor(x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0) {
        super(x, y, z);
        this.rotation = new ObservableVector3(pitch, yaw, roll);
    }
    get yaw() {
        return this.rotation.y;
    }
    set yaw(value) {
        this.rotation.y = value;
    }
    get isDirty() {
        return super.isDirty || this.rotation.hasUpdated(ROTATION_EPSILON);
    }
    clean() {
        super.clean();
        this.rotation.store();
    }
    serialize(writer) {
        super.serialize(writer);
        this.writeRotation(writer);
    }
    serializeUpdate(writer) {
        super.serializeUpdate(writer);
        this.writeRotation(writer);
    }
    writeRotation(writer) {
        const { rotation } = this;
        writer.writeFloat32(rotation.x);
        writer.writeFloat32(rotation.y);
        writer.writeFloat32(rotation.z);
    }
}
