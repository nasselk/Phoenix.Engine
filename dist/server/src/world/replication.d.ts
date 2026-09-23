import type { EntityRegistry } from "../../../shared/world/registry";
import type { Entity } from "./entities/entity";
export declare const REPLICATION_BUFFER_SIZE: number;
export declare class Slot {
    generation: number;
    spawnStart: number;
    spawnEnd: number;
    updateStart: number;
    updateEnd: number;
    constructor();
}
export declare class Seen {
    known: Set<Entity<any>>;
    next: Set<Entity<any>>;
    constructor();
    clear(): void;
}
export declare class Replication {
    private readonly registry;
    private readonly records;
    private readonly writer;
    private generation;
    constructor(registry: EntityRegistry<any>);
    reset(): void;
    frame(seen: Seen, visible: Iterable<Entity<any>>): Uint8Array<ArrayBuffer> | undefined;
    private slot;
    private spawn;
    private update;
    private copy;
}
