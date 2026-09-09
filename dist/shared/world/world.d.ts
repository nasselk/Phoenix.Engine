import { EventEmitter } from "../utils/EventEmitter";
import type { Entity, EntityClass } from "./entity";
import { type UpdateCallback, type UpdateOptions } from "./phase";
import type { EntityDefinitions, EntityRegistry } from "./registry";
export declare const MAX_ENTITIES = 65535;
export type WorldEvents = {
    spawn: [entity: Entity];
    destroy: [entity: Entity];
};
export type WorldRole = "local" | "authority" | "mirror";
export type WorldOptions<D extends EntityDefinitions = EntityDefinitions> = {
    readonly capacity?: number;
    readonly entities?: EntityRegistry<D>;
    readonly role?: WorldRole;
};
export declare class World<E extends Entity = Entity, D extends EntityDefinitions = EntityDefinitions> extends EventEmitter<WorldEvents> {
    readonly entities: Map<number, E>;
    time: number;
    readonly capacity: number;
    readonly entityRegistry?: EntityRegistry<D>;
    readonly role: WorldRole;
    private readonly ids;
    protected readonly list: E[];
    private buried;
    private readonly subscriptions;
    private ordered;
    private dirty;
    constructor(options?: WorldOptions<D>);
    get size(): number;
    onUpdate(callback: UpdateCallback, options?: UpdateOptions): () => void;
    spawn<T extends E>(entity: T, id?: number): T;
    spawn<K extends Extract<keyof D, string>>(kind: K, ...args: ConstructorParameters<D[K]>): InstanceType<D[K]>;
    protected insert<T extends Entity>(entity: T, id: number | undefined, kind?: string): T;
    destroy(entity: E | number): boolean;
    get(id: number): E | undefined;
    get<T extends Entity>(id: number, Kind: EntityClass<T>): T | undefined;
    has(id: number): boolean;
    update(deltaTime: number): void;
    updateEntities(deltaTime: number): void;
    each<T extends Entity>(Kind: EntityClass<T>, callback: (entity: T) => void): void;
    all<T extends Entity>(Kind: EntityClass<T>): T[];
    first<T extends Entity>(Kind: EntityClass<T>): T | undefined;
    count<T extends Entity>(Kind: EntityClass<T>): number;
    protected requireRegistry(what: string): EntityRegistry<D>;
    clear(): void;
    dispose(): void;
    private sweep;
    private reorder;
}
