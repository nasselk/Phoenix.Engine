import { ObservableVector3 } from "../../../../shared/math/vector3";
import { ObservableQuaternion, Quaternion } from "../../../../shared/math/quaternion";
import { Entity } from "./entity";
export const POSITION_EPSILON = 0.000001;
export const ROTATION_EPSILON = 0.01;
export class PositionEntity extends Entity {
    constructor(world, context, options = {}) {
        super(world, context, options);
        this.turns = true;
        this.pushed = new Quaternion();
        this.asleep = false;
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
        this.pushed.set(rotation);
        this.asleep = false;
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
        if (this.turns || this.body === undefined) {
            return;
        }
        const { rotation, pushed } = this;
        if (rotation.x !== pushed.x || rotation.y !== pushed.y || rotation.z !== pushed.z || rotation.w !== pushed.w) {
            this.body.setRotation(rotation, true);
            pushed.set(rotation);
        }
    }
    afterPhysics() {
        const body = this.body;
        const asleep = body.isSleeping();
        if (asleep && this.asleep) {
            return;
        }
        this.asleep = asleep;
        body.translation(this.position);
        if (this.turns) {
            body.rotation(this.rotation);
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
    teleport(a, b, c) {
        if (typeof a === "number") {
            this.position.set(a, b, c);
        }
        else {
            this.position.set(a.x, a.y, a.z);
        }
        this.body?.setTranslation(this.position, false);
    }
    clean() {
        const { position, rotation } = this;
        if (position.hasUpdatedX(POSITION_EPSILON)) {
            position.storeX();
        }
        if (position.hasUpdatedY(POSITION_EPSILON)) {
            position.storeY();
        }
        if (position.hasUpdatedZ(POSITION_EPSILON)) {
            position.storeZ();
        }
        if (rotation.hasUpdated(ROTATION_EPSILON)) {
            rotation.store();
        }
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
