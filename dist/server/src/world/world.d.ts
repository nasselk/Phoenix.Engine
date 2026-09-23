import type { EntityDefinitions } from "../../../shared/world/registry";
import { World as BaseWorld, type WorldOptions } from "../../../shared/world/world";
import type { SpawnArguments } from "../../../shared/world/options";
import type { Contract, OutboundEvent, SendPayload } from "../../../shared/networking/protocol";
import type { NetworkSystem } from "../networking/NetworkSystem";
import { type Socket } from "../networking/socket";
import { RAPIER } from "../../../shared/physics/rapier";
import type { Entity } from "./entities/entity";
import type { PositionEntity } from "./entities/position";
export type ServerWorldOptions<D extends EntityDefinitions, C, N extends Contract = Contract> = WorldOptions<D, C> & {
    readonly inviteCode: string;
    readonly network: NetworkSystem<any, any, any, any, N>;
};
export declare const MAX_SERVER_WORLD_SIZE: number;
export declare class World<D extends EntityDefinitions, C, N extends Contract = Contract> extends BaseWorld<D, C, Entity<C>> {
    readonly inviteCode: string;
    readonly sockets: Set<Socket<N>>;
    readonly physics: RAPIER.World;
    readonly bodies: Set<PositionEntity<any>>;
    private readonly network;
    private readonly replication;
    constructor(options: ServerWorldOptions<D, C, N>);
    protected allocateID(): number;
    update(deltaTime: number): void;
    protected simulate(deltaTime: number): void;
    frame(socket: Socket<N>, visible: Iterable<Entity<C>>): Uint8Array<ArrayBuffer> | undefined;
    clean(): void;
    join(socket: Socket<N>): this;
    leave(socket: Socket<N>): boolean;
    spawn<K extends Extract<keyof D, string>>(kind: K, ...args: SpawnArguments<D[K], 2>): InstanceType<D[K]>;
    broadcast<E extends OutboundEvent<N>>(event: E, ...data: SendPayload<N, E>): this;
    destroy(): void;
}
