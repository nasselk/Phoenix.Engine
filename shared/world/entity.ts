import type { World } from "./world";

export class Entity {
	public id = 0;

	public world!: World<any, any>;

	public spawnTime = 0;

	public alive = false;

	public kind = "";

	public get type(): string {
		return this.constructor.name;
	}

	public get age(): number {
		return this.world.time - this.spawnTime;
	}

	public update(_deltaTime: number): void {}

	public onSpawn(): void {}

	public onDestroy(): void {}

	public destroy(): void {
		this.world?.destroy(this);
	}
}

export type EntityClass<T extends Entity = Entity> = abstract new (...args: never[]) => T;
