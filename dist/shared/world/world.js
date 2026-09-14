import { EventEmitter } from "../utils/EventEmitter";
import { IDAllocator } from "../utils/IDAllocator";
import { warn } from "../utils/logger";
export class World extends EventEmitter {
    constructor(options = {}) {
        super();
        this.entities = new Map();
        this.time = 0;
        this.ids = new IDAllocator();
        this.living = 0;
        const capacity = options.capacity ?? Infinity;
        if (capacity < 1) {
            throw new Error(`World capacity must be at least 1, got ${capacity}`);
        }
        this.capacity = capacity;
        this.entityRegistry = options.entities;
        this.role = options.role ?? "local";
        this.context = options.context;
        this.idReuseDelay = options.idReuseDelay ?? 2500;
    }
    get size() {
        return this.living;
    }
    insert(kind, entity, id) {
        if (entity.alive) {
            warn("World", `Entity ${entity.id} (${entity.type}) is already spawned`);
            return entity;
        }
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
        this.ids.freeWithTimeout(id, this.idReuseDelay);
    }
    get(id, kind) {
        const entity = this.entities.get(id);
        if (entity === undefined || !entity.alive || (kind !== undefined && !this.matches(entity, kind))) {
            return undefined;
        }
        return entity;
    }
    has(id) {
        return this.entities.get(id)?.alive === true;
    }
    update(deltaTime) {
        this.time += deltaTime;
        this.ids.processTimeouts();
        for (const entity of this.entities.values()) {
            if (entity.alive) {
                entity.update(deltaTime);
            }
        }
        this.emit("update", deltaTime);
    }
    each(kind, callback) {
        for (const entity of this.entities.values()) {
            if (entity.alive && this.matches(entity, kind)) {
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
    matches(entity, kind) {
        return typeof kind === "string" ? entity.kind === kind : entity instanceof kind;
    }
    allocateID() {
        const id = this.role === "mirror" ? this.ids.allocateNegative() : this.ids.allocate();
        return id;
    }
    requireRegistry(what) {
        const registry = this.entityRegistry;
        if (registry === undefined) {
            throw new Error(`This world cannot ${what}: it was built without an entity registry. Pass one as \`entities\` — see defineEntities.`);
        }
        return registry;
    }
    clear() {
        for (const entity of [...this.entities.values()]) {
            entity.destroy();
        }
    }
    dispose() {
        this.clear();
        this.removeAllListeners();
    }
}
