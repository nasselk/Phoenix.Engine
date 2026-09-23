import type { Entity, EntityClass } from "./entity";
export type EntityConstructor<T extends Entity<any> = Entity<any>> = new (...args: any[]) => T;
export type EntityDefinitions = Record<string, EntityConstructor>;
export type KindName<D extends EntityDefinitions> = Extract<keyof D, string>;
export type KindInstance<D extends EntityDefinitions, K extends KindName<D>> = InstanceType<D[K]>;
export type KindQuery = string | EntityClass<Entity<any>>;
export declare const MAX_ENTITY_KINDS: number;
export declare class EntityRegistry<D extends EntityDefinitions = EntityDefinitions> {
    readonly names: readonly Extract<keyof D, string>[];
    private readonly definitions;
    private readonly codes;
    private readonly kinds;
    constructor(definitions: D);
    get size(): number;
    has(name: string): boolean;
    code(name: Extract<keyof D, string>): number;
    kind(code: number): Extract<keyof D, string> | undefined;
    class<K extends Extract<keyof D, string>>(name: K): D[K];
    kindOf(entity: Entity<any>): Extract<keyof D, string> | undefined;
    matches<K extends KindName<D>>(entity: Entity<any>, type: K): entity is KindInstance<D, K>;
    matches<T extends Entity<any>>(entity: Entity<any>, kind: EntityClass<T>): entity is T;
    describe(): string;
}
export declare function defineEntities<const D extends EntityDefinitions>(definitions: D): EntityRegistry<D>;
