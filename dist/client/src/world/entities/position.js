import { Interpolator } from "../../../../shared/math/interpolation";
import { Vector3 } from "../../../../shared/math/vector3";
import { Quaternion } from "../../../../shared/math/quaternion";
import { Group } from "three";
import { Entity } from "./entity";
export class PositionEntity extends Entity {
    constructor(world, context, options = {}) {
        super(world, context, options);
        this.smoothPosition = true;
        this.positionSmoothing = PositionEntity.DEFAULT_SMOOTHING;
        this.smoothRotation = true;
        this.rotationSmoothing = PositionEntity.DEFAULT_SMOOTHING;
        this.position = new Vector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
        this.targetPosition = this.position.clone();
        this.rotation = new Quaternion().setFromEuler(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
        this.targetRotation = this.rotation.clone();
        this.group = new Group();
        this.group.rotation.order = "YXZ";
        this.group.userData.entity = this;
    }
    onSpawn() {
        this.syncGroup();
        this.world.group.add(this.group);
    }
    onDestroy() {
        this.group.removeFromParent();
    }
    teleport(a, b, c) {
        if (typeof a === "number") {
            this.targetPosition.set(a, b, c);
            this.position.set(a, b, c);
        }
        else {
            this.targetPosition.set(a);
            this.position.set(a);
        }
    }
    update(deltaTime) {
        const { FRAMES_PER_SECOND, SNAP_DISTANCE, SNAP_ANGLE } = PositionEntity;
        const frames = deltaTime * FRAMES_PER_SECOND;
        if (this.smoothPosition) {
            const { position, targetPosition, positionSmoothing } = this;
            Interpolator.lerpVector(position, targetPosition, positionSmoothing, frames, SNAP_DISTANCE);
        }
        else {
            this.teleport(this.targetPosition);
        }
        if (this.smoothRotation) {
            const { rotation, targetRotation, rotationSmoothing } = this;
            Interpolator.slerpQuaternion(rotation, targetRotation, rotationSmoothing, frames, SNAP_ANGLE);
        }
        else {
            this.rotation.set(this.targetRotation);
        }
        this.syncGroup();
    }
    syncGroup() {
        const { position, rotation, group } = this;
        group.position.set(position.x, position.y, position.z);
        group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    deserialize(reader) {
        const x = reader.readFloat32();
        const y = reader.readFloat32();
        const z = reader.readFloat32();
        this.targetPosition.set(x, y, z);
        this.targetRotation.unpack(reader.readUint32());
        this.position.set(this.targetPosition);
        this.rotation.set(this.targetRotation);
    }
    deserializeUpdate(reader) {
        const px = reader.readBoolean();
        const py = reader.readBoolean();
        const pz = reader.readBoolean();
        const turned = reader.readBoolean();
        const { targetPosition } = this;
        if (px) {
            targetPosition.x = reader.readFloat32();
        }
        if (py) {
            targetPosition.y = reader.readFloat32();
        }
        if (pz) {
            targetPosition.z = reader.readFloat32();
        }
        if (turned) {
            this.targetRotation.unpack(reader.readUint32());
        }
    }
    get yaw() {
        return this.rotation.yaw;
    }
}
PositionEntity.FRAMES_PER_SECOND = 60;
PositionEntity.DEFAULT_SMOOTHING = 0.25;
PositionEntity.SNAP_DISTANCE = 0.001;
PositionEntity.SNAP_ANGLE = 0.0005;
