import { EventEmitter } from "../utils/EventEmitter";
import { IDAllocator } from "../utils/IDAllocator";
import type { Entity, EntityClass } from "./entity";
import type { EntityDefinitions, EntityRegistry, KindInstance, KindName, KindQuery } from "./registry";

export type WorldEvents = {
	spawn: [entity: Entity<any>];
	destroy: [entity: Entity<any>];
	update: [deltaTime: number];
};

export type WorldOptions<D extends EntityDefinitions, C> = {
	readonly capacity?: number;
	readonly entities: EntityRegistry<D>;
	readonly context?: C;
};

export abstract class World<D extends EntityDefinitions, C, E extends Entity<C> = Entity<C>> extends EventEmitter<WorldEvents> {
	public readonly entities = new Map<number, E>();
	public readonly capacity: number;
	public readonly registry: EntityRegistry<D>;
	protected readonly context: C;
	protected readonly ids = new IDAllocator();
	private living = 0;
	public time = 0;

	protected abstract allocateID(): number;

	public constructor(options: WorldOptions<D, C>) {
		super();

		const capacity = options.capacity ?? Infinity;

		if (capacity < 1) {
			throw new Error(`World capacity must be at least 1, got ${capacity}`);
		}

		this.capacity = capacity;
		this.registry = options.entities;
		this.context = options.context as C;
	}

	/**
	 * The shared half of each side's `spawn`: the entity is already built, with this world and context,
	 * and this gives it an id, a kind and a place in the map.
	 */
	protected insert<T extends Entity<any>>(kind: string, entity: T, id: number | undefined): T {
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

		this.simulate(deltaTime);

		this.emit("update", deltaTime);
	}

	/**
	 * What moves everything at once, like a physics step: after every entity has had its say this
	 * tick, and before `update` listeners see the result. Nothing, unless a side has something to run.
	 */
	protected simulate(_deltaTime: number): void {}

	public onEntityDestroy(entity: Entity<any>): void {
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

	public get(id: number): E | undefined;
	public get<K extends KindName<D>>(id: number, kind: K): KindInstance<D, K> | undefined;
	public get<T extends Entity<any>>(id: number, Kind: EntityClass<T>): T | undefined;
	public get(id: number, kind?: KindQuery): Entity<any> | undefined {
		const entity = this.entities.get(id);

		// A destroyed entity waits in the map until the tick ends; it is gone as far as anyone asking is concerned.
		if (entity === undefined || !entity.alive || (kind !== undefined && !this.registry.matches(entity, kind as EntityClass<Entity<any>>))) {
			return undefined;
		}

		return entity;
	}

	public has(id: number): boolean;
	public has<K extends KindName<D>>(id: number, kind: K): boolean;
	public has<T extends Entity<any>>(id: number, Kind: EntityClass<T>): boolean;
	public has(id: number, kind?: KindQuery): boolean {
		return this.get(id, kind as EntityClass<Entity<any>>) !== undefined;
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
	public each<T extends Entity<any>>(kind: EntityClass<T>, callback: (entity: T) => void): void;
	public each(kind: KindQuery, callback: (entity: any) => void): void {
		for (const entity of this.entities.values()) {
			if (entity.alive && this.registry.matches(entity, kind as EntityClass<Entity<any>>)) {
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
	public all<T extends Entity<any>>(kind: EntityClass<T>): T[];
	public all(kind: KindQuery): Entity<any>[] {
		const found: Entity<any>[] = [];

		this.each(kind as EntityClass<Entity<any>>, (entity) => found.push(entity));

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
	public count<T extends Entity<any>>(kind: EntityClass<T>): number;
	public count(kind: KindQuery): number {
		let total = 0;

		this.each(kind as EntityClass<Entity<any>>, () => {
			total++;
		});

		return total;
	}

	public clear(...kinds: KindQuery[]): void {
		if (kinds.length === 0) {
			for (const entity of [...this.entities.values()]) {
				entity.destroy();
			}
		} else {
			for (const entity of [...this.entities.values()]) {
				if (kinds.some((kind) => this.registry.matches(entity, kind as EntityClass<Entity<any>>))) {
					entity.destroy();
				}
			}
		}
	}

	public destroy(): void {
		this.clear();

		this.removeAllListeners();
	}

	/** The number of live entities in the world. */
	public get size(): number {
		return this.living;
	}
}
