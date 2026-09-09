import type { World } from "./world";
export declare class Entity {
    id: number;
    world: World<any, any>;
    spawnTime: number;
    alive: boolean;
    kind: string;
    get type(): string;
    get age(): number;
    update(_deltaTime: number): void;
    onSpawn(): void;
    onDestroy(): void;
    destroy(): void;
}
export type EntityClass<T extends Entity = Entity> = abstract new (...args: never[]) => T;
