import type { EntityDefinitions } from "../../shared/world/registry";
import type { WorldOptions } from "../../shared/world/world";
import type { Entity } from "./world/entity";
import { World } from "./world/world";
export declare class GameRoom<D extends EntityDefinitions = EntityDefinitions> extends World<D> {
    readonly id: number;
    readonly inviteCode: string;
    readonly players: Set<Entity>;
    constructor(id: number, inviteCode: string, options?: WorldOptions<D>);
    addPlayer(player: Entity): void;
    removePlayer(player: Entity): void;
    dispose(): void;
}
