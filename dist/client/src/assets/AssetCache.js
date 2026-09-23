export class AssetCache {
    constructor() {
        this.kinds = new Map();
        this.disposers = new Map();
        this.setDisposer("material", (material) => material.dispose());
        this.setDisposer("geometry", (geometry) => geometry.dispose());
    }
    setDisposer(kind, dispose) {
        this.disposers.set(kind, dispose);
        return this;
    }
    get(kind, id) {
        return this.kinds.get(kind)?.get(id);
    }
    has(kind, id) {
        return this.kinds.get(kind)?.has(id) === true;
    }
    entries(kind) {
        return (this.kinds.get(kind) ?? new Map()).entries();
    }
    set(kind, id, value) {
        const entries = this.table(kind);
        const previous = entries.get(id);
        if (previous !== undefined && previous !== value) {
            this.free(kind, previous);
        }
        entries.set(id, value);
        return value;
    }
    getOrCreate(kind, id, create) {
        return this.get(kind, id) ?? this.set(kind, id, create());
    }
    release(kind, id) {
        const entries = this.kinds.get(kind);
        const value = entries?.get(id);
        if (entries === undefined || value === undefined) {
            return false;
        }
        entries.delete(id);
        this.free(kind, value);
        return true;
    }
    clear(...kinds) {
        for (const [name, entries] of this.kinds) {
            if (kinds.length > 0 && !kinds.includes(name)) {
                continue;
            }
            for (const value of entries.values()) {
                this.free(name, value);
            }
            entries.clear();
        }
    }
    free(kind, value) {
        this.disposers.get(kind)?.(value);
    }
    table(kind) {
        let entries = this.kinds.get(kind);
        if (entries === undefined) {
            entries = new Map();
            this.kinds.set(kind, entries);
        }
        return entries;
    }
}
