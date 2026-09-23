import type { World } from "./world";
export type EntityOptions = {
    readonly id?: number;
};
export declare abstract class Entity<C> {
    id: number;
    readonly world: World<any, any, any>;
    readonly context: C;
    spawnTime: number;
    alive: boolean;
    kind: string;
    constructor(world: World<any, any, any>, context: C);
    abstract update(deltaTime: number): void;
    onSpawn(): void;
    onDestroy(): void;
    destroy(): boolean;
    get age(): number;
    get type(): string;
}
export type EntityClass<T extends Entity<any> = Entity<any>> = abstract new (...args: never[]) => T;
