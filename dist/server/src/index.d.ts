import { GameLoop, type GameLoopParams } from "./GameLoop";
import { World } from "./world/world";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import type { SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions, EntityRegistry } from "../../shared/world/registry";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export * from "../../shared/index";
export { Entity } from "./world/entity";
export { MovingEntity, MIN_SPEED as STOP_SPEED } from "./world/moving";
export { BoxCollider, Collider, ColliderKind, collide, collideBoxBox, collideBoxPlane, DEFAULT_MASS, inverseMass, MIN_SLIDE, PlaneCollider, RESTITUTION_THRESHOLD, resolve, SLOP, type Collision, type ResolveOptions } from "./world/collision/index";
export { POSITION_EPSILON, PositionEntity, ROTATION_EPSILON, type PositionEntityOptions } from "./world/position";
export { World, type ServerWorldOptions } from "./world/world";
export { GameLoop, type GameLoopParams } from "./GameLoop";
export { DEFAULT_NETWORK_SETTINGS, NetworkSystem, type EventLimit, type EventLimits, type NetworkSettings, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { Socket, SocketState, type SocketUserData } from "./networking/socket";
export { setExitListeners } from "./utils/utils";
type EngineEvents = {
    init: [];
    destroy: [];
};
export declare const DEFAULT_ROOM_CAPACITY = 5000;
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, D extends EntityDefinitions = EntityDefinitions, C = unknown> = {
    readonly capacity?: number;
    readonly entities?: EntityRegistry<D>;
    readonly context?: C;
    readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
    readonly loop?: Partial<GameLoopParams>;
};
export declare class Engine<const In extends readonly string[] = [], const Out extends readonly string[] = [], const InSchemas extends SchemasFor<InSchemas, In> = {}, const OutSchemas extends SchemasFor<OutSchemas, Out> = {}, const D extends EntityDefinitions = EntityDefinitions, C = unknown> extends EventEmitter<EngineEvents> {
    readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
    readonly loop: GameLoop;
    readonly rooms: Map<number, World<D, C>>;
    private readonly entities?;
    private readonly capacity;
    private readonly roomIDs;
    private readonly roomsByInviteCode;
    private readonly context;
    constructor(options?: EngineOptions<In, Out, InSchemas, OutSchemas, D, C>);
    createRoom(inviteCode?: string): World<D, C>;
    getRoom(id: number): World<D, C> | undefined;
    getRoomByInviteCode(inviteCode: string): World<D, C> | undefined;
    destroyRoom(id: number): boolean;
    init(): Promise<void>;
    destroy(): void;
}
