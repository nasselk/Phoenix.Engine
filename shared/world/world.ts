import { EventEmitter } from "../utils/EventEmitter";
import { IDAllocator } from "../utils/IDAllocator";
import { warn } from "../utils/logger";
import type { Entity, EntityClass } from "./entity";
import { Phase, type UpdateCallback, type UpdateOptions } from "./phase";
import type { EntityDefinitions, EntityRegistry } from "./registry";

export const MAX_ENTITIES = 65_535;

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

interface Subscription {
	callback: UpdateCallback;
	phase: number;
	priority: number;
}

export class World<E extends Entity = Entity, D extends EntityDefinitions = EntityDefinitions> extends EventEmitter<WorldEvents> {
	public readonly entities = new Map<number, E>();

	public time = 0;

	public readonly capacity: number;

	public readonly entityRegistry?: EntityRegistry<D>;

	public readonly role: WorldRole;

	private readonly ids = new IDAllocator();

	protected readonly list: E[] = [];
	private buried = 0;

	private readonly subscriptions: Subscription[] = [];

	private ordered: UpdateCallback[] = [];
	private dirty = false;

	public constructor(options: WorldOptions<D> = {}) {
		super();

		const capacity = options.capacity ?? MAX_ENTITIES;

		if (capacity < 1 || capacity > MAX_ENTITIES) {
			throw new Error(`World capacity must be between 1 and ${MAX_ENTITIES}, got ${capacity}`);
		}

		this.capacity = capacity;
		this.entityRegistry = options.entities;
		this.role = options.role ?? "local";

		this.onUpdate((deltaTime) => this.updateEntities(deltaTime), { phase: Phase.Update });
	}

	public get size(): number {
		return this.entities.size;
	}

	public onUpdate(callback: UpdateCallback, options: UpdateOptions = {}): () => void {
		const subscription: Subscription = {
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

	public spawn<T extends E>(entity: T, id?: number): T;
	public spawn<K extends Extract<keyof D, string>>(kind: K, ...args: ConstructorParameters<D[K]>): InstanceType<D[K]>;
	public spawn(entityOrKind: Entity | string, ...args: unknown[]): Entity {
		if (typeof entityOrKind === "string") {
			const registry = this.requireRegistry("spawn by name");

			type Kind = Extract<keyof D, string>;

			return this.insert(registry.create(entityOrKind as Kind, ...(args as ConstructorParameters<D[Kind]>)), undefined, entityOrKind);
		}

		return this.insert(entityOrKind, args[0] as number | undefined);
	}

	protected insert<T extends Entity>(entity: T, id: number | undefined, kind?: string): T {
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

		this.entities.set(entity.id, entity as unknown as E);
		this.list.push(entity as unknown as E);

		entity.onSpawn();

		this.emit("spawn", entity);

		return entity;
	}

	public destroy(entity: E | number): boolean {
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

	public get(id: number): E | undefined;
	public get<T extends Entity>(id: number, Kind: EntityClass<T>): T | undefined;
	public get(id: number, Kind?: EntityClass<Entity>): E | undefined {
		const entity = this.entities.get(id);

		if (Kind !== undefined && !(entity instanceof Kind)) {
			return undefined;
		}

		return entity;
	}

	public has(id: number): boolean {
		return this.entities.has(id);
	}

	public update(deltaTime: number): void {
		this.time += deltaTime;

		if (this.dirty) {
			this.reorder();
		}

		const ordered = this.ordered;

		for (let i = 0; i < ordered.length; i++) {
			ordered[i](deltaTime);
		}
	}

	public updateEntities(deltaTime: number): void {
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

	public each<T extends Entity>(Kind: EntityClass<T>, callback: (entity: T) => void): void {
		const list = this.list;

		for (let i = 0; i < list.length; i++) {
			const entity = list[i];

			if (entity.alive && entity instanceof Kind) {
				callback(entity as T);
			}
		}
	}

	public all<T extends Entity>(Kind: EntityClass<T>): T[] {
		const found: T[] = [];

		this.each(Kind, (entity) => found.push(entity));

		return found;
	}

	public first<T extends Entity>(Kind: EntityClass<T>): T | undefined {
		const list = this.list;

		for (let i = 0; i < list.length; i++) {
			const entity = list[i];

			if (entity.alive && entity instanceof Kind) {
				return entity as T;
			}
		}

		return undefined;
	}

	public count<T extends Entity>(Kind: EntityClass<T>): number {
		let total = 0;

		this.each(Kind, () => {
			total++;
		});

		return total;
	}

	protected requireRegistry(what: string): EntityRegistry<D> {
		const registry = this.entityRegistry;

		if (registry === undefined) {
			throw new Error(`This world cannot ${what}: it was built without an entity registry. Pass one as \`entities\` — see defineEntities.`);
		}

		return registry;
	}

	public clear(): void {
		for (const entity of [...this.list]) {
			this.destroy(entity);
		}

		this.sweep();
	}

	public dispose(): void {
		this.clear();

		this.subscriptions.length = 0;
		this.ordered = [];
		this.dirty = false;

		this.removeAllListeners();
	}

	private sweep(): void {
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

	private reorder(): void {
		this.subscriptions.sort((a, b) => a.phase - b.phase || a.priority - b.priority);
		this.ordered = this.subscriptions.map((subscription) => subscription.callback);
		this.dirty = false;
	}
}
