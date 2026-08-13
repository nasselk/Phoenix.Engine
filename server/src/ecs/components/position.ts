import { Component, type Entity, type World } from "../world";

export function addPosition(world: World, id: Entity, x: number = 0, y: number = 0): void {
	world.masks[id] |= Component.Position;
	world.positionX[id] = x;
	world.positionY[id] = y;
}

export function removePosition(world: World, id: Entity): void {
	world.masks[id] &= ~Component.Position;
}
