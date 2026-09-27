import { ObservableVector3 } from "../../../../shared/math/vector3";
import { ObservableQuaternion } from "../../../../shared/math/quaternion";
import { Entity } from "./entity";
export const POSITION_EPSILON = 0.000001;
export const ROTATION_EPSILON = 0.01;
export class PositionEntity extends Entity {
    constructor(world, context, options = {}) {
        super(world, context, options);
        this.turns = true;
        this.position = new ObservableVector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
        this.rotation = new ObservableQuaternion().setFromEuler(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
        this.rotation.store();
    }
    embody(body, ...shapes) {
        const { physics } = this.room;
        const { position, rotation } = this;
        if (this.body !== undefined) {
            physics.removeRigidBody(this.body);
        }
        body.setTranslation(position.x, position.y, position.z);
        body.setRotation(rotation.clone());
        body.userData = this;
        this.turns = body.rotationsEnabledX || body.rotationsEnabledY || body.rotationsEnabledZ;
        this.body = physics.createRigidBody(body);
        for (const shape of shapes) {
            physics.createCollider(shape, this.body);
        }
        this.room.bodies.add(this);
        return this.body;
    }
    beforePhysics() {
        if (!this.turns) {
            const { body, rotation } = this;
            body?.setRotation(rotation, false);
        }
    }
    afterPhysics() {
        const body = this.body;
        const { x, y, z } = body.translation();
        this.position.set(x, y, z);
        if (this.turns) {
            this.rotation.set(body.rotation());
        }
    }
    onDestroy() {
        super.onDestroy();
        if (this.body !== undefined) {
            this.room.physics.removeRigidBody(this.body);
            this.room.bodies.delete(this);
            this.body = undefined;
        }
    }
    clean() {
        this.position.store();
        this.rotation.store();
    }
    serialize(writer) {
        const { position, rotation } = this;
        writer.writeFloat32(position.x);
        writer.writeFloat32(position.y);
        writer.writeFloat32(position.z);
        writer.writeUint32(rotation.pack());
    }
    serializeUpdate(writer) {
        const { position, rotation } = this;
        const px = position.hasUpdatedX(POSITION_EPSILON);
        const py = position.hasUpdatedY(POSITION_EPSILON);
        const pz = position.hasUpdatedZ(POSITION_EPSILON);
        const turned = rotation.hasUpdated(ROTATION_EPSILON);
        writer.writeBoolean(px);
        writer.writeBoolean(py);
        writer.writeBoolean(pz);
        writer.writeBoolean(turned);
        if (px) {
            writer.writeFloat32(position.x);
        }
        if (py) {
            writer.writeFloat32(position.y);
        }
        if (pz) {
            writer.writeFloat32(position.z);
        }
        if (turned) {
            writer.writeUint32(rotation.pack());
        }
    }
    get room() {
        return this.world;
    }
    get yaw() {
        return this.rotation.yaw;
    }
    set yaw(value) {
        this.rotation.setFromYaw(value);
    }
    get isDirty() {
        return this.position.hasUpdated(POSITION_EPSILON) || this.rotation.hasUpdated(ROTATION_EPSILON);
    }
}
