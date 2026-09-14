import type { BufferReader } from "@nasselk/binarypack";
import { Entity as BaseEntity, type EntityOptions } from "../../../shared/world/entity";
import type { Engine } from "..";
import type { World } from "./world";

/**
 * `C` is what `this.context` is, and `G` what `this.group` is: the scene container this entity adds
 * whatever it draws to — a three.js Object3D, a pixi Container. Without a context of its own, a
 * world's context is the engine; without a group of its own, its group is the renderer's world.
 */
export abstract class Entity<C = Engine, G = unknown> extends BaseEntity<C> {
	public readonly group: G;

	/**
	 * Built by `world.spawn(kind, options)`, or by the world itself off the wire — where there are no
	 * options beyond an id, so every client option needs a default.
	 */
	public constructor(world: World<any, any, any>, context: C, group: G, _options: EntityOptions = {}) {
		super(world, context);

		this.group = group;
	}

	public abstract render(deltaTime: number): void;

	public abstract deserialize(reader: BufferReader): void;

	public abstract deserializeUpdate(reader: BufferReader): void;
}
