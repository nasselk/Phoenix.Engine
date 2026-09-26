import type { ColliderDesc, RigidBody, RigidBodyDesc, Rotation } from "@dimforge/rapier3d-compat";
import { BufferWriter } from "@nasselk/binarypack";
import { ObservableVector3 } from "../../../../shared/math/vector3";
import { eulerToQuaternion, quaternionToEuler } from "../../../../shared/physics/rapier";
import type { EntityOptions } from "../../../../shared/world/entity";
import { Entity } from "./entity";
import type { World } from "../world";
import { wrap } from "../../../../shared";

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
	/** Scratch space for the rotation conversions, which run for every body every tick. */
	private static readonly quaternion: Rotation = { x: 0, y: 0, z: 0, w: 1 };
	private static readonly euler: [number, number, number] = [0, 0, 0];

	public readonly position: ObservableVector3;
	public readonly rotation: ObservableVector3;

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
		this.rotation = new ObservableVector3(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0);
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

	/** Before the step: what code decided about this body since the last one. */
	public beforePhysics(): void {
		if (!this.turns) {
			const { body, rotation } = this;

			body?.setRotation(eulerToQuaternion(rotation.x, rotation.y, rotation.z, PositionEntity.quaternion), false);
		}
	}

	/** After the step: where the physics put it. */
	public afterPhysics(): void {
		const body = this.body!;
		const { x, y, z } = body.translation();

		this.position.set(x, y, z);

		if (this.turns) {
			const [pitch, yaw, roll] = quaternionToEuler(body.rotation(), PositionEntity.euler);

			this.rotation.set(pitch, yaw, roll);
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

	public override clean(): void {
		this.position.store();
		this.rotation.store();
	}

	public override serialize(writer: BufferWriter): void {
		const { position, rotation } = this;

		writer.writeFloat32(position.x);
		writer.writeFloat32(position.y);
		writer.writeFloat32(position.z);

		writer.writeUint8(rotation.x);
		writer.writeUint8(rotation.y);
		writer.writeUint8(rotation.z);
	}

	public override serializeUpdate(writer: BufferWriter): void {
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

	protected get room(): World<any, any> {
		return this.world as World<any, any>;
	}

	public get yaw(): number {
		return this.rotation.y;
	}

	public set yaw(value: number) {
		this.rotation.y = value;
	}

	public override get isDirty(): boolean {
		return this.position.hasUpdated(POSITION_EPSILON) || this.rotation.hasUpdated(ROTATION_EPSILON);
	}
}
