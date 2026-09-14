import { EventEmitter } from "../utils/EventEmitter";
import { IDAllocator } from "../utils/IDAllocator";
import { warn } from "../utils/logger";
import type { Entity, EntityClass } from "./entity";
import type { EntityDefinitions, EntityRegistry } from "./registry";

export type WorldEvents = {
	spawn: [entity: Entity];
	destroy: [entity: Entity];
	update: [deltaTime: number];
};

export type WorldRole = "local" | "authority" | "mirror";

export type WorldOptions<D extends EntityDefinitions = EntityDefinitions, C = unknown> = {
	readonly capacity?: number;
	readonly entities?: EntityRegistry<D>;
	readonly role?: WorldRole;
	readonly idReuseDelay?: number;
	readonly context?: C;
};

type KindName<D extends EntityDefinitions> = Extract<keyof D, string>;
type KindInstance<D extends EntityDefinitions, K extends KindName<D>> = InstanceType<D[K]>;
type KindQuery = string | EntityClass<Entity>;

/**
 * `E` is what the map holds: each side's own Entity, with this world's context, so the side that
 * subclasses this can call its own methods on what it iterates without casting.
 */
export class World<D extends EntityDefinitions = EntityDefinitions, C = unknown, E extends Entity<C> = Entity<C>> extends EventEmitter<WorldEvents> {
	public readonly entities = new Map<number, E>();

	public time = 0;

	public readonly capacity: number;

	public readonly entityRegistry?: EntityRegistry<D>;

	public readonly role: WorldRole;

	public readonly context: C;

	private readonly ids = new IDAllocator();

	private readonly idReuseDelay: number;

	private living = 0;

	public constructor(options: WorldOptions<D, C> = {}) {
		super();

		const capacity = options.capacity ?? Infinity;

		if (capacity < 1) {
			throw new Error(`World capacity must be at least 1, got ${capacity}`);
		}

		this.capacity = capacity;
		this.entityRegistry = options.entities;
		this.role = options.role ?? "local";
		this.context = options.context as C;
		this.idReuseDelay = options.idReuseDelay ?? 2500;
	}

	/** Live entities. Not `entities.size`: a destroyed entity stays in the map until the tick ends. */
	public get size(): number {
		return this.living;
	}

	/**
	 * The shared half of each side's `spawn`: the entity is already built, with this world and context,
	 * and this gives it an id, a kind and a place in the map.
	 */
	protected insert<T extends Entity<any>>(kind: string, entity: T, id: number | undefined): T {
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

		this.entities.set(entity.id, entity as unknown as E);
		this.living++;

		entity.onSpawn();

		this.emit("spawn", entity);

		return entity;
	}

	public onEntityDestroy(entity: Entity): void {
		const id = entity.id;

		this.living--;

		// Deferred to the end of the tick, so nothing iterating the map this tick has it shift under
		// it. Until then the entity is still in the map but no longer alive, which is what every loop
		// and query checks. Only removed if the slot still holds it.
		queueMicrotask(() => {
			if (this.entities.get(id) === entity) {
				this.entities.delete(id);
			}
		});

		entity.onDestroy();

		this.emit("destroy", entity);

		// Held back rather than freed: a message about this id may still be on its way somewhere.
		this.ids.freeWithTimeout(id, this.idReuseDelay);
	}

	public get(id: number): E | undefined;
	public get<K extends KindName<D>>(id: number, kind: K): KindInstance<D, K> | undefined;
	public get<T extends Entity>(id: number, Kind: EntityClass<T>): T | undefined;
	public get(id: number, kind?: KindQuery): Entity | undefined {
		const entity = this.entities.get(id);

		// A destroyed entity waits in the map until the tick ends; it is gone as far as anyone asking is concerned.
		if (entity === undefined || !entity.alive || (kind !== undefined && !this.matches(entity, kind as EntityClass<Entity>))) {
			return undefined;
		}

		return entity;
	}

	public has(id: number): boolean {
		return this.entities.get(id)?.alive === true;
	}

	/** Advance the clock, update every entity, then tell `update` listeners the tick happened. */
	public update(deltaTime: number): void {
		this.time += deltaTime;

		// Ids whose reuse delay has run out go back in the pool, before anything this tick spawns.
		this.ids.processTimeouts();

		for (const entity of this.entities.values()) {
			if (entity.alive) {
				entity.update(deltaTime);
			}
		}

		this.emit("update", deltaTime);
	}

	/**
	 * Call a function for each live entity of a certain type.
	 *
	 * @param type The type of entity to iterate over.
	 * @param callback The function to call for each entity of that kind.
	 */
	public each<K extends KindName<D>>(type: K, callback: (entity: KindInstance<D, K>) => void): void;
	/**
	 * Call a function for each live entity of a certain class.
	 *
	 * @param kind  The class of the entity to iterate over.
	 * @param callback The function to call for each entity of that kind and its subclasses.
	 */
	public each<T extends Entity>(kind: EntityClass<T>, callback: (entity: T) => void): void;
	public each(kind: KindQuery, callback: (entity: any) => void): void {
		for (const entity of this.entities.values()) {
			if (entity.alive && this.matches(entity, kind as EntityClass<Entity>)) {
				callback(entity);
			}
		}
	}

	/**
	 * @param type The type of entity to retrieve.
	 * @returns An array of all live entities of that kind.
	 */
	public all<K extends KindName<D>>(kind: K): KindInstance<D, K>[];
	/**
	 * @param kind The class of the entity to retrieve.
	 * @returns An array of all live entities of that kind and its subclasses.
	 */
	public all<T extends Entity>(kind: EntityClass<T>): T[];
	public all(kind: KindQuery): Entity[] {
		const found: Entity[] = [];

		this.each(kind as EntityClass<Entity>, (entity) => found.push(entity));

		return found;
	}

	/**
	 * @param type The type of entity to count.
	 * @returns The number of live entities of that kind.
	 */
	public count<K extends KindName<D>>(type: K): number;
	/**
	 *
	 * @param kind The kind's class.
	 * @returns The number of live entities of that kind and its subclasses.
	 */
	public count<T extends Entity>(kind: EntityClass<T>): number;
	public count(kind: KindQuery): number {
		let total = 0;

		this.each(kind as EntityClass<Entity>, () => {
			total++;
		});

		return total;
	}

	/** A name matches the kind the entity was registered under; a class matches it and its subclasses. */
	public matches<K extends KindName<D>>(entity: Entity, type: K): entity is KindInstance<D, K>;
	public matches<T extends Entity>(entity: Entity, kind: EntityClass<T>): entity is T;
	public matches(entity: Entity, kind: KindQuery): boolean {
		return typeof kind === "string" ? entity.kind === kind : entity instanceof kind;
	}

	/**
	 * A fresh id: positive for anything that can go on the wire, negative for a mirror's local-only
	 * entities so they never collide with the authority's.
	 *
	 * An id is two bytes on the wire, and ids held back for ID_REUSE_DELAY are not in the pool, so
	 * the next id grows with recent deaths and not only with live entities. Past a uint16 it would
	 * silently wrap on the wire and alias another entity — this refuses instead.
	 */
	protected allocateID(): number {
		const id = this.role === "mirror" ? this.ids.allocateNegative() : this.ids.allocate();

		return id;
	}

	protected requireRegistry(what: string): EntityRegistry<D> {
		const registry = this.entityRegistry;

		if (registry === undefined) {
			throw new Error(`This world cannot ${what}: it was built without an entity registry. Pass one as \`entities\` — see defineEntities.`);
		}

		return registry;
	}

	public clear(): void {
		// A copy, so an onDestroy that spawns something does not have it destroyed in the same pass.
		for (const entity of [...this.entities.values()]) {
			entity.destroy();
		}
	}

	public dispose(): void {
		this.clear();

		this.removeAllListeners();
	}
}
