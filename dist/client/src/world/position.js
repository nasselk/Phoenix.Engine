import { Interpolator } from "../../../shared/libs/math/interpolation";
import { ObservableVector3, Vector3 } from "../../../shared/libs/math/vector3D";
import { Entity } from "./entity";
export const FRAME = 1000 / 60;
export const DEFAULT_SMOOTHING = 0.25;
export const SNAP_DISTANCE = 0.001;
export class PositionEntity extends Entity {
    constructor(x = 0, y = 0, z = 0) {
        super();
        this.interpolation = true;
        this.smoothing = DEFAULT_SMOOTHING;
        this.position = new ObservableVector3(x, y, z);
        this.targetPosition = new Vector3(x, y, z);
    }
    deserialize(reader) {
        this.readPosition(reader);
        this.position.set(this.targetPosition);
    }
    deserializeUpdate(reader) {
        this.readPosition(reader);
        if (!this.interpolation) {
            this.position.set(this.targetPosition);
        }
    }
    update(deltaTime) {
        if (!this.interpolation) {
            return;
        }
        const { position, targetPosition, smoothing } = this;
        const frames = deltaTime / FRAME;
        position.set(Interpolator.lerp(position.x, targetPosition.x, smoothing, frames, SNAP_DISTANCE), Interpolator.lerp(position.y, targetPosition.y, smoothing, frames, SNAP_DISTANCE), Interpolator.lerp(position.z, targetPosition.z, smoothing, frames, SNAP_DISTANCE));
    }
    readPosition(reader) {
        const x = reader.readFloat32();
        const y = reader.readFloat32();
        const z = reader.readFloat32();
        this.targetPosition.set(x, y, z);
    }
}
