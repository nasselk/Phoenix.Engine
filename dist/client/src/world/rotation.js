import { Interpolator } from "../../../shared/libs/math/interpolation";
import { ObservableVector3, Vector3 } from "../../../shared/libs/math/vector3D";
import { FRAME, PositionEntity } from "./position";
export const SNAP_ANGLE = 0.0005;
export class RotationEntity extends PositionEntity {
    constructor(x = 0, y = 0, z = 0, pitch = 0, yaw = 0, roll = 0) {
        super(x, y, z);
        this.rotationInterpolation = true;
        this.rotation = new ObservableVector3(pitch, yaw, roll);
        this.targetRotation = new Vector3(pitch, yaw, roll);
        this.rotationSmoothing = this.smoothing;
    }
    get yaw() {
        return this.rotation.y;
    }
    set yaw(value) {
        this.rotation.y = value;
    }
    deserialize(reader) {
        super.deserialize(reader);
        this.readRotation(reader);
        this.rotation.set(this.targetRotation);
    }
    deserializeUpdate(reader) {
        super.deserializeUpdate(reader);
        this.readRotation(reader);
        if (!this.rotationInterpolation) {
            this.rotation.set(this.targetRotation);
        }
    }
    update(deltaTime) {
        super.update(deltaTime);
        if (!this.rotationInterpolation) {
            return;
        }
        const { rotation, targetRotation, rotationSmoothing } = this;
        const frames = deltaTime / FRAME;
        rotation.set(Interpolator.lerpAngle(rotation.x, targetRotation.x, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.y, targetRotation.y, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.z, targetRotation.z, rotationSmoothing, frames, SNAP_ANGLE));
    }
    readRotation(reader) {
        const pitch = reader.readFloat32();
        const yaw = reader.readFloat32();
        const roll = reader.readFloat32();
        this.targetRotation.set(pitch, yaw, roll);
    }
}
