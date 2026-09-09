import type { EntityDefinitions } from "../../shared/world/registry";
import type { WorldOptions } from "../../shared/world/world";
import type { Entity } from "./world/entity";
import { World } from "./world/world";

export class GameRoom<D extends EntityDefinitions = EntityDefinitions> extends World<D> {
	public readonly players = new Set<Entity>();

	public constructor(
		public readonly id: number,
		public readonly inviteCode: string,
		options: WorldOptions<D> = {},
	) {
		super(options);
	}

	public addPlayer(player: Entity): void {
		this.players.add(player);
	}

	public removePlayer(player: Entity): void {
		this.players.delete(player);
	}

	public override dispose(): void {
		this.players.clear();

		super.dispose();
	}
}
