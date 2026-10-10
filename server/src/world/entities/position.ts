import type { ColliderDesc, RigidBody, RigidBodyDesc } from "@dimforge/rapier3d-simd-compat";
import { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../../shared/math/vector3";
import { ObservableQuaternion, Quaternion } from "../../../../shared/math/quaternion";
import { RAPIER } from "../../../../shared/physics/rapier";
import type { EntityOptions } from "../../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "../world";
import { Vector3Like } from "three";

export const POSITION_EPSILON = 0.000001;

export const ROTATION_EPSILON = 0.01;

export type PositionEntityOptions = EntityOptions & {
	readonly x?: number;
	readonly y?: number;
	readonly z?: number;
	readonly pitch?: number;
	readonly yaw?: number;
	readonly roll?: number;
};

export abstract class PositionEntity<C> extends Entity<C> {
	public readonly position: ObservableVector3;
	/** Which way it is turned. Set it with `setFromEuler` or `yaw`; read which way it faces with `yaw`. */
	public readonly rotation: ObservableQuaternion;

	/**
	 * Its body in the room's physics, once `embody` has given it one. From then on the physics moves
	 * it: after every step the body's position is copied back here, and that is what goes on the wire.
	 */
	public body?: RigidBody;

	/**
	 * Whether the physics turns it. A body with every rotation locked is turned by code instead — a
	 * player facing where it walks — and its rotation goes the other way, from here to the body.
	 */
	private turns = true;

	/** The rotation last given to the body, for a body code turns: it is only touched again when this differs. */
	private readonly pushed = new Quaternion();

	/** Whether the body was asleep after the last step: one asleep before and after a step cannot have moved. */
	private asleep = false;

	/** What it is touching, and through how many pairs of colliders, so two colliders on one entity make one touch. */
	private readonly touching = new Map<PositionEntity<any>, number>();

	public constructor(world: World<any, any>, context: C, options: PositionEntityOptions = {}) {
		super(world, context, options);

		this.position = new ObservableVector3(options.x ?? 0, options.y ?? 0, options.z ?? 0);
		this.rotation = new ObservableQuaternion().setFromEuler(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
		this.rotation.store();
	}

	/**
	 * Give this entity a body in its room, where it stands and facing the way it faces, made of the
	 * shapes given. Lock every rotation on the body for something code turns, like a player.
	 *
	 *   this.embody(RAPIER.RigidBodyDesc.dynamic(), [RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)]);
	 */
	protected embody(body: RigidBodyDesc, ...shapes: readonly ColliderDesc[]): RigidBody {
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
		this.untouchAll();
		this.body = physics.createRigidBody(body);

		const listens = this.onTouch !== PositionEntity.prototype.onTouch || this.onTouchEnd !== PositionEntity.prototype.onTouchEnd;

		for (const shape of shapes) {
			if (listens) {
				shape.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS).setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
			}

			physics.createCollider(shape, this.body);
		}

		this.room.bodies.add(this);

		return this.body;
	}

	/**
	 * Another entity started touching this one: a solid contact, or overlapping a sensor collider
	 * (`ColliderDesc.setSensor(true)`). Once per entity however many of their colliders touch. Override
	 * it, or `onTouchEnd`, and this entity's colliders report touches; any other entity they touch hears
	 * of it too. Two fixed bodies never touch: one of the two must move.
	 */
	public onTouch(other: PositionEntity<any>): void {}

	/** Another entity stopped touching this one, moved apart or destroyed. */
	public onTouchEnd(other: PositionEntity<any>): void {}

	/** A pair of their colliders started or stopped touching. Called by the room after each step. */
	public touch(other: PositionEntity<any>, started: boolean): void {
		const pairs = (this.touching.get(other) ?? 0) + (started ? 1 : -1);

		if (pairs > 0) {
			this.touching.set(other, pairs);

			if (started && pairs === 1) {
				this.onTouch(other);
			}
		} else if (this.touching.delete(other)) {
			this.onTouchEnd(other);
		}
	}

	/** Whether it is touching that entity right now. */
	public isTouching(other: PositionEntity<any>): boolean {
		return this.touching.has(other);
	}

	/** End every touch at once, on both sides, when its body goes: its colliders will never report the end themselves. */
	private untouchAll(): void {
		for (const other of this.touching.keys()) {
			if (other.touching.delete(this)) {
				other.onTouchEnd(this);
			}
		}

		this.touching.clear();
	}

	/** Before the step: what code decided about this body since the last one. */
	public beforePhysics(): void {
		if (this.turns || this.body === undefined) {
			return;
		}

		const { rotation, pushed } = this;

		if (rotation.x !== pushed.x || rotation.y !== pushed.y || rotation.z !== pushed.z || rotation.w !== pushed.w) {
			this.body.setRotation(rotation, true);
			pushed.set(rotation);
		}
	}

	/** After the step: where the physics put it. */
	public afterPhysics(): void {
		const body = this.body!;
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

	public override onDestroy(): void {
		super.onDestroy();

		if (this.body !== undefined) {
			this.untouchAll();
			this.room.physics.removeRigidBody(this.body);
			this.room.bodies.delete(this);

			this.body = undefined;
		}
	}

	public teleport(position: Vector3Like): void;
	public teleport(x: number, y: number, z: number): void;
	public teleport(a: number | Vector3Like, b?: number, c?: number): void {
		if (typeof a === "number") {
			this.position.set(a, b, c);
		} else {
			this.position.set(a.x, a.y, a.z);
		}

		this.body?.setTranslation(this.position, false);
	}

	/** Only what `serializeUpdate` sent counts as sent: a change still under its epsilon keeps adding up until it is. */
	public override clean(): void {
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

	public override serialize(writer: BufferWriter): void {
		const { position, rotation } = this;

		writer.writeFloat32(position.x);
		writer.writeFloat32(position.y);
		writer.writeFloat32(position.z);
		writer.writeUint32(rotation.pack());
	}

	public override serializeUpdate(writer: BufferWriter): void {
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

	protected get room(): World<any, any> {
		return this.world as World<any, any>;
	}

	/** Which way it faces on the ground. Setting it turns it upright to face that way. */
	public get yaw(): number {
		return this.rotation.yaw;
	}

	public set yaw(value: number) {
		this.rotation.setFromYaw(value);
	}

	public override get isDirty(): boolean {
		return this.position.hasUpdated(POSITION_EPSILON) || this.rotation.hasUpdated(ROTATION_EPSILON);
	}
}
