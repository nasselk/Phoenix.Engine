import type { ColliderDesc, RigidBody, RigidBodyDesc } from "@dimforge/rapier3d-simd-compat";
import { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../../shared/math/vector3";
import { ObservableQuaternion } from "../../../../shared/math/quaternion";
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
		body.userData = this;

		this.turns = body.rotationsEnabledX || body.rotationsEnabledY || body.rotationsEnabledZ;
		this.body = physics.createRigidBody(body);

		for (const shape of shapes) {
			physics.createCollider(shape, this.body);
		}

		this.room.bodies.add(this);

		return this.body;
	}

	/** Before the step: what code decided about this body since the last one. */
	public beforePhysics(): void {
		if (!this.turns) {
			const { body, rotation } = this;

			body?.setRotation(rotation, false);
		}
	}

	/** After the step: where the physics put it. */
	public afterPhysics(): void {
		const body = this.body!;
		const { x, y, z } = body.translation();

		this.position.set(x, y, z);

		if (this.turns) {
			this.rotation.set(body.rotation());
		}
	}

	public override onDestroy(): void {
		super.onDestroy();

		if (this.body !== undefined) {
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
