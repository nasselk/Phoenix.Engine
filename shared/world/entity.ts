import type { World } from "./world";

/** What every kind's options have in common. Each kind extends it with the fields it takes. */
export type EntityOptions = {
	/** Spawn under this id instead of one the world allocates. */
	readonly id?: number;
};

export abstract class Entity<C = unknown> {
	public id = 0;

	public readonly world: World<any, any, any>;
	public readonly context: C;
	public spawnTime = 0;
	public alive = false;
	public kind = "";

	public constructor(world: World<any, any, any>, context: C) {
		this.world = world;
		this.context = context;
	}

	public get age(): number {
		return this.world.time - this.spawnTime;
	}

	public get type(): string {
		return this.constructor.name;
	}

	public abstract update(deltaTime: number): void;

	public onSpawn(): void {}

	public onDestroy(): void {}

	/**
	 * Remove this entity from its world: run its onDestroy hook, announce it, and hold its id back.
	 * Calling it twice, on an entity that was never spawned, or during a tick, is fine — it returns
	 * false and does nothing.
	 */
	public destroy(): boolean {
		if (!this.alive) {
			return false;
		}

		// Cleared first, so a destroy() from inside onDestroy() cannot recurse.
		this.alive = false;

		this.world.onEntityDestroy(this);

		return true;
	}
}

export type EntityClass<T extends Entity = Entity> = abstract new (...args: never[]) => T;
