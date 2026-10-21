export const MAX_ENTITY_KINDS = 2 ** 8;
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
    kind(code) {
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
    matches(entity, kind) {
        return typeof kind === "string" ? entity.kind === kind : entity instanceof kind;
    }
    describe() {
        return this.names.map((name, code) => `${code}: ${name}`).join(", ");
    }
}
export function defineEntities(definitions) {
    return new EntityRegistry(definitions);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zaGFyZWQvd29ybGQvcmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBWUEsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUV2QyxNQUFNLE9BQU8sY0FBYztJQU8xQixZQUFtQixXQUFjO1FBQ2hDLE1BQU0sS0FBSyxHQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFnQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRTlFLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sSUFBSSxVQUFVLENBQUMsK0NBQStDLGdCQUFnQixlQUFlLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3BILENBQUM7UUFFRCxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRXZCLEtBQUssSUFBSSxJQUFJLEdBQUcsQ0FBQyxFQUFFLElBQUksR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7WUFDaEQsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXpCLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUUzQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQzlDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFD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