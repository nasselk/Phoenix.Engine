import { EventEmitter } from "../utils/EventEmitter";
import { IDAllocator } from "../utils/IDAllocator";
export class World extends EventEmitter {
    constructor(options) {
        super();
        this.entities = new Map();
        this.ids = new IDAllocator();
        this.living = 0;
        this.time = 0;
        const capacity = options.capacity ?? Infinity;
        if (capacity < 1) {
            throw new Error(`World capacity must be at least 1, got ${capacity}`);
        }
        this.capacity = capacity;
        this.registry = options.entities;
        this.context = options.context;
    }
    insert(kind, entity, id) {
        if (this.living >= this.capacity) {
            throw new Error(`World is full (capacity ${this.capacity})`);
        }
        entity.id = id ?? this.allocateID();
        entity.spawnTime = this.time;
        entity.alive = true;
        entity.kind = kind;
        this.entities.set(entity.id, entity);
        this.living++;
        entity.onSpawn();
        this.emit("spawn", entity);
        return entity;
    }
    update(deltaTime) {
        this.time += deltaTime;
        this.ids.processTimeouts();
        for (const entity of this.entities.values()) {
            if (entity.alive) {
                entity.update(deltaTime);
            }
        }
        this.simulate(deltaTime);
        this.emit("update", deltaTime);
    }
    simulate(_deltaTime) { }
    onEntityDestroy(entity) {
        const id = entity.id;
        this.living--;
        queueMicrotask(() => {
            if (this.entities.get(id) === entity) {
                this.entities.delete(id);
            }
        });
        entity.onDestroy();
        this.emit("destroy", entity);
        this.ids.freeWithTimeout(id, 5000);
    }
    get(id, kind) {
        const entity = this.entities.get(id);
        if (entity === undefined || !entity.alive || (kind !== undefined && !this.registry.matches(entity, kind))) {
            return undefined;
        }
        return entity;
    }
    has(id, kind) {
        return this.get(id, kind) !== undefined;
    }
    each(kind, callback) {
        for (const entity of this.entities.values()) {
            if (entity.alive && this.registry.matches(entity, kind)) {
                callback(entity);
            }
        }
    }
    all(kind) {
        const found = [];
        this.each(kind, (entity) => found.push(entity));
        return found;
    }
    count(kind) {
        let total = 0;
        this.each(kind, () => {
            total++;
        });
        return total;
    }
    clear(...kinds) {
        if (kinds.length === 0) {
            for (const entity of [...this.entities.values()]) {
                entity.destroy();
            }
        }
        else {
            for (const entity of [...this.entities.values()]) {
                if (kinds.some((kind) => this.registry.matches(entity, kind))) {
                    entity.destroy();
                }
            }
        }
    }
    destroy() {
        this.clear();
        this.removeAllListeners();
    }
    get size() {
        return this.living;
    }
}
