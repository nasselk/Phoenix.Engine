import { IDAllocator } from "../../../shared/utils/IDAllocator";
import { warn } from "../../../shared/utils/logger";

export type Entity = number;

export const MAX_ENTITIES = 100_000;

// Component bitmask flags. Each component gets one bit; an entity's mask
// tells every system what it has with a single & check.
export const Component = {
	Position: 1 << 0,
} as const;

// Bit 31 marks the entity slot as alive so a mask of 0 always means "free slot",
// even for entities that have no components yet.
const ALIVE = 1 << 31;

export interface World {
	capacity: number;
	// One past the highest id ever allocated: systems only scan [0, entityCount).
	entityCount: number;
	// Hands out entity ids and recycles destroyed ones. Ids start at 1,
	// so id 0 is reserved as the "no entity" sentinel.
	allocator: IDAllocator;
	// Per-entity component bitmask. masks[eid] === 0 → free slot.
	masks: Uint32Array;
	// Position component, struct-of-arrays.
	positionX: Float64Array;
	positionY: Float64Array;
}

export function createWorld(capacity: number = MAX_ENTITIES): World {
	const size = capacity + 1; // +1 because id 0 is reserved as the "no entity" sentinel.

	return {
		capacity,
		entityCount: 1,
		allocator: new IDAllocator(),
		masks: new Uint32Array(size),
		positionX: new Float64Array(size),
		positionY: new Float64Array(size),
	};
}

export function createEntity(world: World): Entity {
	const id = world.allocator.allocate();

	if (id > world.capacity) {
		world.allocator.free(id);

		throw new Error(`World is full (capacity ${world.capacity})`);
	}

	world.masks[id] = ALIVE;
	if (id >= world.entityCount) {
		world.entityCount = id + 1;
	}

	return id;
}

export function destroyEntity(world: World, id: Entity): void {
	if (world.masks[id] === 0) {
		warn("ECS", `Trying to destroy a non-alive entity with id ${id}`);

		return;
	}

	world.masks[id] = 0;
	world.allocator.free(id);
}

export function isAlive(world: World, id: Entity): boolean {
	return world.masks[id] !== 0;
}

export function hasComponent(world: World, id: Entity, component: number): boolean {
	return (world.masks[id] & component) !== 0;
}
