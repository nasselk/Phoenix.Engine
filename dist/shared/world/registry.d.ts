import type { Entity } from "./entity";
export type EntityConstructor<T extends Entity = Entity> = new (...args: any[]) => T;
export type EntityDefinitions = Record<string, EntityConstructor>;
export declare const MAX_ENTITY_KINDS = 256;
export declare class EntityRegistry<D extends EntityDefinitions = EntityDefinitions> {
    readonly names: readonly Extract<keyof D, string>[];
    private readonly definitions;
    private readonly codes;
    private readonly kinds;
    constructor(definitions: D);
    get size(): number;
    has(name: string): boolean;
    code(name: Extract<keyof D, string>): number;
    name(code: number): Extract<keyof D, string> | undefined;
    class<K extends Extract<keyof D, string>>(name: K): D[K];
    kindOf(entity: Entity): Extract<keyof D, string> | undefined;
    describe(): string;
}
export declare function defineEntities<const D extends EntityDefinitions>(definitions: D): EntityRegistry<D>;
