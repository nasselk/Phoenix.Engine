import { BufferReader } from "@nasselk/binarypack";
import { Interpolator } from "../../../../shared/math/interpolation";
import { Vector3 } from "../../../../shared/math/vector3";
import { Group } from "three";
import { Entity } from "./entity";
export class PositionEntity extends Entity {
    constructor(world, context, options = {}) {
        super(world, context, options);
        this.positionSmoothing = true;
        this.smoothing = PositionEntity.DEFAULT_SMOOTHING;
        this.rotationInterpolation = true;
        this.rotationSmoothing = PositionEntity.DEFAULT_SMOOTHING;
        this.position = new Vector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
        this.targetPosition = this.position.clone();
        this.rotation = new Vector3(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
        this.targetRotation = this.rotation.clone();
        this.group = new Group();
        this.group.rotation.order = "YXZ";
        this.group.userData.entity = this;
        this.syncGroup();
    }
    onSpawn() {
        this.syncGroup();
        this.world.group.add(this.group);
    }
    onDestroy() {
        this.group.removeFromParent();
    }
    update(deltaTime) {
        const { FRAMES_PER_SECOND, SNAP_DISTANCE, SNAP_ANGLE } = PositionEntity;
        const frames = deltaTime * FRAMES_PER_SECOND;
        if (this.positionSmoothing) {
            const { position, targetPosition, smoothing } = this;
            Interpolator.lerpVector(position, targetPosition, smoothing, frames, SNAP_DISTANCE);
        }
        else {
            this.position.set(this.targetPosition);
        }
        if (this.rotationInterpolation) {
            const { rotation, targetRotation, rotationSmoothing } = this;
            rotation.set(Interpolator.lerpAngle(rotation.x, targetRotation.x, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.y, targetRotation.y, rotationSmoothing, frames, SNAP_ANGLE), Interpolator.lerpAngle(rotation.z, targetRotation.z, rotationSmoothing, frames, SNAP_ANGLE));
        }
        else {
            this.rotation.set(this.targetRotation);
        }
        this.syncGroup();
    }
    syncGroup() {
        const { position, rotation, group } = this;
        group.position.set(position.x, position.y, position.z);
        group.rotation.set(rotation.x, rotation.y, rotation.z);
    }
    deserialize(reader) {
        const x = reader.readFloat32();
        const y = reader.readFloat32();
        const z = reader.readFloat32();
        this.targetPosition.set(x, y, z);
        const pitch = reader.readFloat32();
        const yaw = reader.readFloat32();
        const roll = reader.readFloat32();
        this.targetRotation.set(pitch, yaw, roll);
        this.position.set(this.targetPosition);
        this.rotation.set(this.targetRotation);
    }
    deserializeUpdate(reader) {
        const px = reader.readBoolean();
        const py = reader.readBoolean();
        const pz = reader.readBoolean();
        const rx = reader.readBoolean();
        const ry = reader.readBoolean();
        const rz = reader.readBoolean();
        const { targetPosition, targetRotation } = this;
        if (px) {
            targetPosition.x = reader.readFloat32();
        }
        if (py) {
            targetPosition.y = reader.readFloat32();
        }
        if (pz) {
            targetPosition.z = reader.readFloat32();
        }
        if (rx) {
            const rotation = reader.readFloat32();
            targetRotation.x = BufferReader.fromPrecision(rotation, 2 * Math.PI, 8);
        }
        if (ry) {
            const rotation = reader.readFloat32();
            targetRotation.y = BufferReader.fromPrecision(rotation, 2 * Math.PI, 8);
        }
        if (rz) {
            const rotation = reader.readFloat32();
            targetRotation.z = BufferReader.fromPrecision(rotation, 2 * Math.PI, 8);
        }
    }
}
PositionEntity.FRAMES_PER_SECOND = 60;
PositionEntity.DEFAULT_SMOOTHING = 0.25;
PositionEntity.SNAP_DISTANCE = 0.001;
PositionEntity.SNAP_ANGLE = 0.0005;
