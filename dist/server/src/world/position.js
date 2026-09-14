import { ObservableVector3 } from "../../../shared/libs/math/vector3D";
import { Entity } from "./entity";
export const POSITION_EPSILON = 0.01;
export const ROTATION_EPSILON = 0.01;
export class PositionEntity extends Entity {
    constructor(world, context, options = {}) {
        super(world, context, options);
        this.position = new ObservableVector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
        this.rotation = new ObservableVector3(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
    }
    get yaw() {
        return this.rotation.y;
    }
    set yaw(value) {
        this.rotation.y = value;
    }
    get isDirty() {
        return this.position.hasUpdated(POSITION_EPSILON) || this.rotation.hasUpdated(ROTATION_EPSILON);
    }
    clean() {
        this.position.store();
        this.rotation.store();
    }
    serialize(writer) {
        this.writeTransforms(writer);
    }
    serializeUpdate(writer) {
        const { position, rotation } = this;
        const px = position.hasUpdatedX(POSITION_EPSILON);
        const py = position.hasUpdatedY(POSITION_EPSILON);
        const pz = position.hasUpdatedZ(POSITION_EPSILON);
        const rx = rotation.hasUpdatedX(ROTATION_EPSILON);
        const ry = rotation.hasUpdatedY(ROTATION_EPSILON);
        const rz = rotation.hasUpdatedZ(ROTATION_EPSILON);
        writer.writeBoolean(px);
        writer.writeBoolean(py);
        writer.writeBoolean(pz);
        writer.writeBoolean(rx);
        writer.writeBoolean(ry);
        writer.writeBoolean(rz);
        if (px) {
            writer.writeFloat32(position.x);
        }
        if (py) {
            writer.writeFloat32(position.y);
        }
        if (pz) {
            writer.writeFloat32(position.z);
        }
        if (rx) {
            writer.writeFloat32(rotation.x);
        }
        if (ry) {
            writer.writeFloat32(rotation.y);
        }
        if (rz) {
            writer.writeFloat32(rotation.z);
        }
    }
    writeTransforms(writer) {
        const { position, rotation } = this;
        writer.writeFloat32(position.x);
        writer.writeFloat32(position.y);
        writer.writeFloat32(position.z);
        writer.writeFloat32(rotation.x);
        writer.writeFloat32(rotation.y);
        writer.writeFloat32(rotation.z);
    }
}
