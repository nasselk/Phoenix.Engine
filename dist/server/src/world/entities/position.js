import { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../../shared/math/vector3";
import { eulerToQuaternion, quaternionToEuler } from "../../../../shared/physics/rapier";
import { Entity } from "./entity";
import { wrap } from "../../../../shared";
export const POSITION_EPSILON = 0.000001;
export const ROTATION_EPSILON = 0.01;
export class PositionEntity extends Entity {
    constructor(world, context, options = {}) {
        super(world, context, options);
        this.turns = true;
        this.position = new ObservableVector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
        this.rotation = new ObservableVector3(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
    }
    embody(body, ...shapes) {
        const { physics } = this.room;
        const { position, rotation } = this;
        if (this.body !== undefined) {
            physics.removeRigidBody(this.body);
        }
        body.setTranslation(position.x, position.y, position.z);
        body.setRotation(eulerToQuaternion(rotation.x, rotation.y, rotation.z, { x: 0, y: 0, z: 0, w: 1 }));
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
            body?.setRotation(eulerToQuaternion(rotation.x, rotation.y, rotation.z, PositionEntity.quaternion), false);
        }
    }
    afterPhysics() {
        const body = this.body;
        const { x, y, z } = body.translation();
        this.position.set(x, y, z);
        if (this.turns) {
            const [pitch, yaw, roll] = quaternionToEuler(body.rotation(), PositionEntity.euler);
            this.rotation.set(pitch, yaw, roll);
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
        writer.writeUint8(rotation.x);
        writer.writeUint8(rotation.y);
        writer.writeUint8(rotation.z);
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
            const rotation = BufferWriter.toPrecision(wrap(this.rotation.x, 0, 2 * Math.PI), 2 * Math.PI, 8);
            writer.writeFloat32(rotation);
        }
        if (ry) {
            const rotation = BufferWriter.toPrecision(wrap(this.rotation.y, 0, 2 * Math.PI), 2 * Math.PI, 8);
            writer.writeFloat32(rotation);
        }
        if (rz) {
            const rotation = BufferWriter.toPrecision(wrap(this.rotation.z, 0, 2 * Math.PI), 2 * Math.PI, 8);
            writer.writeFloat32(rotation);
        }
    }
    get room() {
        return this.world;
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
}
PositionEntity.quaternion = { x: 0, y: 0, z: 0, w: 1 };
PositionEntity.euler = [0, 0, 0];
