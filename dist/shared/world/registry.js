export const MAX_ENTITY_KINDS = 256;
export class EntityRegistry {
    constructor(definitions) {
        const names = Object.keys(definitions).sort();
        if (names.length > MAX_ENTITY_KINDS) {
            throw new RangeError(`An entity registry cannot declare more than ${MAX_ENTITY_KINDS} kinds, got ${names.length}`);
        }
        this.definitions = definitions;
        this.names = names;
        this.codes = new Map();
        this.kinds = new Map();
        for (let code = 0; code < names.length; code++) {
            const name = names[code];
            this.codes.set(name, code);
            if (!this.kinds.has(this.definitions[name])) {
                this.kinds.set(this.definitions[name], name);
            }
        }
    }
    get size() {
        return this.names.length;
    }
    has(name) {
        return this.codes.has(name);
    }
    code(name) {
        const code = this.codes.get(name);
        if (code === undefined) {
            throw new Error(`Unknown entity kind "${name}". Declared kinds are [ ${this.names.join(", ")} ]`);
        }
        return code;
    }
    name(code) {
        return this.names[code];
    }
    class(name) {
        const Kind = this.definitions[name];
        if (Kind === undefined) {
            throw new Error(`Unknown entity kind "${name}". Declared kinds are [ ${this.names.join(", ")} ]`);
        }
        return Kind;
    }
    kindOf(entity) {
        let constructor = entity.constructor;
        while (constructor !== null && constructor !== Function.prototype) {
            const kind = this.kinds.get(constructor);
            if (kind !== undefined) {
                return kind;
            }
            constructor = Object.getPrototypeOf(constructor);
        }
        return undefined;
    }
    create(name, ...args) {
        return new (this.class(name))(...args);
    }
    instantiate(name) {
        return new (this.class(name))();
    }
    describe() {
        return this.names.map((name, code) => `${code}: ${name}`).join(", ");
    }
}
export function defineEntities(definitions) {
    return new EntityRegistry(definitions);
}
