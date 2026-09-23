import { EventEmitter } from "../utils/EventEmitter";
import { IDAllocator } from "../utils/IDAllocator";
import type { Entity, EntityClass } from "./entity";
import type { EntityDefinitions, EntityRegistry, KindInstance, KindName, KindQuery } from "./registry";
export type WorldEvents = {
    spawn: [entity: Entity<any>];
    destroy: [entity: Entity<any>];
    update: [deltaTime: number];
};
export type WorldOptions<D extends EntityDefinitions, C> = {
    readonly capacity?: number;
    readonly entities: EntityRegistry<D>;
    readonly context?: C;
};
export declare abstract class World<D extends EntityDefinitions, C, E extends Entity<C> = Entity<C>> extends EventEmitter<WorldEvents> {
    readonly entities: Map<number, E>;
    readonly capacity: number;
    readonly registry: EntityRegistry<D>;
    protected readonly context: C;
    protected readonly ids: IDAllocator;
    private living;
    time: number;
    protected abstract allocateID(): number;
    constructor(options: WorldOptions<D, C>);
    protected insert<T extends Entity<any>>(kind: string, entity: T, id: number | undefined): T;
    update(deltaTime: number): void;
    protected simulate(_deltaTime: number): void;
    onEntityDestroy(entity: Entity<any>): void;
    get(id: number): E | undefined;
    get<K extends KindName<D>>(id: number, kind: K): KindInstance<D, K> | undefined;
    get<T extends Entity<any>>(id: number, Kind: EntityClass<T>): T | undefined;
    has(id: number): boolean;
    has<K extends KindName<D>>(id: number, kind: K): boolean;
    has<T extends Entity<any>>(id: number, Kind: EntityClass<T>): boolean;
    each<K extends KindName<D>>(type: K, callback: (entity: KindInstance<D, K>) => void): void;
    each<T extends Entity<any>>(kind: EntityClass<T>, callback: (entity: T) => void): void;
    all<K extends KindName<D>>(kind: K): KindInstance<D, K>[];
    all<T extends Entity<any>>(kind: EntityClass<T>): T[];
    count<K extends KindName<D>>(type: K): number;
    count<T extends Entity<any>>(kind: EntityClass<T>): number;
    clear(...kinds: KindQuery[]): void;
    destroy(): void;
    get size(): number;
}
