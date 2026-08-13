import { Component, type World } from "../world";

export function movementSystem(world: World): void {
	const masks = world.masks;
	const x = world.positionX;
	const y = world.positionY;
	const count = world.entityCount;

	for (let id = 0; id < count; id++) {
		// Skip entities that don't have a Position component. This is the only way to know if an entity is alive or not, since we don't have a separate "alive" array.
		if ((masks[id] & Component.Position) === 0) {
			continue;
		}

		// Move entity by one unit
		x[id] += 1;
		y[id] += 1;
	}
}
