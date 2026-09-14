import type { World } from "./world";
export type EntityOptions = {
    readonly id?: number;
};
export declare abstract class Entity<C = unknown> {
    id: number;
    readonly world: World<any, any, any>;
    readonly context: C;
    spawnTime: number;
    alive: boolean;
    kind: string;
    constructor(world: World<any, any, any>, context: C);
    get age(): number;
    get type(): string;
    abstract update(deltaTime: number): void;
    onSpawn(): void;
    onDestroy(): void;
    destroy(): boolean;
}
export type EntityClass<T extends Entity = Entity> = abstract new (...args: never[]) => T;
