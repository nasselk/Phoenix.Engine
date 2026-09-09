import { EventEmitter } from "../utils/EventEmitter";
import { IDAllocator } from "../utils/IDAllocator";
import { warn } from "../utils/logger";
import { Phase } from "./phase";
export const MAX_ENTITIES = 65535;
export class World extends EventEmitter {
    constructor(options = {}) {
        super();
        this.entities = new Map();
        this.time = 0;
        this.ids = new IDAllocator();
        this.list = [];
        this.buried = 0;
        this.subscriptions = [];
        this.ordered = [];
        this.dirty = false;
        const capacity = options.capacity ?? MAX_ENTITIES;
        if (capacity < 1 || capacity > MAX_ENTITIES) {
            throw new Error(`World capacity must be between 1 and ${MAX_ENTITIES}, got ${capacity}`);
        }
        this.capacity = capacity;
        this.entityRegistry = options.entities;
        this.role = options.role ?? "local";
        this.onUpdate((deltaTime) => this.updateEntities(deltaTime), { phase: Phase.Update });
    }
    get size() {
        return this.entities.size;
    }
    onUpdate(callback, options = {}) {
        const subscription = {
            callback,
            phase: options.phase ?? Phase.Update,
            priority: options.priority ?? 0,
        };
        this.subscriptions.push(subscription);
        this.dirty = true;
        return () => {
            const index = this.subscriptions.indexOf(subscription);
            if (index !== -1) {
                this.subscriptions.splice(index, 1);
                this.dirty = true;
            }
        };
    }
    spawn(entityOrKind, ...args) {
        if (typeof entityOrKind === "string") {
            const registry = this.requireRegistry("spawn by name");
            return this.insert(registry.create(entityOrKind, ...args), undefined, entityOrKind);
        }
        return this.insert(entityOrKind, args[0]);
    }
    insert(entity, id, kind) {
        if (entity.alive) {
            warn("World", `Entity ${entity.id} (${entity.type}) is already spawned`);
            return entity;
        }
        if (this.entities.size >= this.capacity) {
            throw new Error(`World is full (capacity ${this.capacity})`);
        }
        entity.id = id ?? (this.role === "mirror" ? this.ids.allocateNegative() : this.ids.allocate());
        entity.world = this;
        entity.spawnTime = this.time;
        entity.alive = true;
        entity.kind = kind ?? this.entityRegistry?.kindOf(entity) ?? "";
        this.entities.set(entity.id, entity);
        this.list.push(entity);
        entity.onSpawn();
        this.emit("spawn", entity);
        return entity;
    }
    destroy(entity) {
        const target = typeof entity === "number" ? this.entities.get(entity) : entity;
        if (target === undefined || !target.alive) {
            return false;
        }
        target.alive = false;
        this.entities.delete(target.id);
        target.onDestroy();
        this.emit("destroy", target);
        this.ids.free(target.id);
        this.buried++;
        return true;
    }
    get(id, Kind) {
        const entity = this.entities.get(id);
        if (Kind !== undefined && !(entity instanceof Kind)) {
            return undefined;
        }
        return entity;
    }
    has(id) {
        return this.entities.has(id);
    }
    update(deltaTime) {
        this.time += deltaTime;
        if (this.dirty) {
            this.reorder();
        }
        const ordered = this.ordered;
        for (let i = 0; i < ordered.length; i++) {
            ordered[i](deltaTime);
        }
    }
    updateEntities(deltaTime) {
        const list = this.list;
        const count = list.length;
        for (let i = 0; i < count; i++) {
            const entity = list[i];
            if (entity.alive) {
                entity.update(deltaTime);
            }
        }
        if (this.buried > 0) {
            this.sweep();
        }
    }
    each(Kind, callback) {
        const list = this.list;
        for (let i = 0; i < list.length; i++) {
            const entity = list[i];
            if (entity.alive && entity instanceof Kind) {
                callback(entity);
            }
        }
    }
    all(Kind) {
        const found = [];
        this.each(Kind, (entity) => found.push(entity));
        return found;
    }
    first(Kind) {
        const list = this.list;
        for (let i = 0; i < list.length; i++) {
            const entity = list[i];
            if (entity.alive && entity instanceof Kind) {
                return entity;
            }
        }
        return undefined;
    }
    count(Kind) {
        let total = 0;
        this.each(Kind, () => {
            total++;
        });
        return total;
    }
    requireRegistry(what) {
        const registry = this.entityRegistry;
        if (registry === undefined) {
            throw new Error(`This world cannot ${what}: it was built without an entity registry. Pass one as \`entities\` — see defineEntities.`);
        }
        return registry;
    }
    clear() {
        for (const entity of [...this.list]) {
            this.destroy(entity);
        }
        this.sweep();
    }
    dispose() {
        this.clear();
        this.subscriptions.length = 0;
        this.ordered = [];
        this.dirty = false;
        this.removeAllListeners();
    }
    sweep() {
        const list = this.list;
        let write = 0;
        for (let read = 0; read < list.length; read++) {
            const entity = list[read];
            if (entity.alive) {
                list[write++] = entity;
            }
        }
        list.length = write;
        this.buried = 0;
    }
    reorder() {
        this.subscriptions.sort((a, b) => a.phase - b.phase || a.priority - b.priority);
        this.ordered = this.subscriptions.map((subscription) => subscription.callback);
        this.dirty = false;
    }
}
