import type { Entity } from "./entity";

export type EntityConstructor<T extends Entity = Entity> = new (...args: any[]) => T;

export type EntityDefinitions = Record<string, EntityConstructor>;

export const MAX_ENTITY_KINDS = 256;

export class EntityRegistry<D extends EntityDefinitions = EntityDefinitions> {
	public readonly names: readonly Extract<keyof D, string>[];

	private readonly definitions: D;
	private readonly codes: Map<string, number>;
	private readonly kinds: Map<EntityConstructor, Extract<keyof D, string>>;

	public constructor(definitions: D) {
		const names = (Object.keys(definitions) as Extract<keyof D, string>[]).sort();

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

			if (!this.kinds.has(this.definitions[name]!)) {
				this.kinds.set(this.definitions[name]!, name);
			}
		}
	}

	public get size(): number {
		return this.names.length;
	}

	public has(name: string): boolean {
		return this.codes.has(name);
	}

	public code(name: Extract<keyof D, string>): number {
		const code = this.codes.get(name);

		if (code === undefined) {
			throw new Error(`Unknown entity kind "${name}". Declared kinds are [ ${this.names.join(", ")} ]`);
		}

		return code;
	}

	public name(code: number): Extract<keyof D, string> | undefined {
		return this.names[code];
	}

	public class<K extends Extract<keyof D, string>>(name: K): D[K] {
		const Kind = this.definitions[name];

		if (Kind === undefined) {
			throw new Error(`Unknown entity kind "${name}". Declared kinds are [ ${this.names.join(", ")} ]`);
		}

		return Kind;
	}

	public kindOf(entity: Entity): Extract<keyof D, string> | undefined {
		let constructor = entity.constructor as EntityConstructor | null;

		while (constructor !== null && constructor !== Function.prototype) {
			const kind = this.kinds.get(constructor);

			if (kind !== undefined) {
				return kind;
			}

			constructor = Object.getPrototypeOf(constructor) as EntityConstructor | null;
		}

		return undefined;
	}

	public describe(): string {
		return this.names.map((name, code) => `${code}: ${name}`).join(", ");
	}
}

export function defineEntities<const D extends EntityDefinitions>(definitions: D): EntityRegistry<D> {
	return new EntityRegistry(definitions);
}
