import { addPosition } from "./ecs/components/position";
import { movementSystem } from "./ecs/systems/movement";
import { createEntity, createWorld } from "./ecs/world";

const world = createWorld();

const player = createEntity(world);
addPosition(world, player, 10, 20);

const enemy = createEntity(world);
addPosition(world, enemy);

// Simulate 3 ticks by hand for now.
for (let tick = 1; tick <= 3; tick++) {
	movementSystem(world);
	console.log(`tick ${tick}: player=(${world.positionX[player]}, ${world.positionY[player]}) enemy=(${world.positionX[enemy]}, ${world.positionY[enemy]})`);
}
