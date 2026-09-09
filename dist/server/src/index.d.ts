import { GameLoop } from "./GameLoop";
import { GameRoom } from "./room";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import type { SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions, EntityRegistry } from "../../shared/world/registry";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export * from "../../shared/index";
export { Entity } from "./world/entity";
export { MovingEntity } from "./world/moving";
export { POSITION_EPSILON, PositionEntity } from "./world/position";
export { ROTATION_EPSILON, RotationEntity } from "./world/rotation";
export { World } from "./world/world";
export { GameLoop } from "./GameLoop";
export { GameRoom } from "./room";
export { DEFAULT_NETWORK_SETTINGS, NetworkSystem, type EventLimit, type EventLimits, type NetworkSettings, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { Socket, SocketState, type SocketUserData } from "./networking/socket";
export { setExitListeners } from "./utils/utils";
type EngineEvents = {
    init: [];
    destroy: [];
};
export declare const DEFAULT_ROOM_CAPACITY = 5000;
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, D extends EntityDefinitions = EntityDefinitions> = {
    readonly capacity?: number;
    readonly entities?: EntityRegistry<D>;
    readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
};
export declare class Engine<const In extends readonly string[] = [], const Out extends readonly string[] = [], const InSchemas extends SchemasFor<InSchemas, In> = {}, const OutSchemas extends SchemasFor<OutSchemas, Out> = {}, const D extends EntityDefinitions = EntityDefinitions> extends EventEmitter<EngineEvents> {
    readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
    readonly loop: GameLoop;
    readonly rooms: Map<number, GameRoom<D>>;
    private readonly entities?;
    private readonly capacity;
    private readonly roomIDs;
    private readonly roomsByInviteCode;
    constructor(options?: EngineOptions<In, Out, InSchemas, OutSchemas, D>);
    createRoom(inviteCode?: string): GameRoom<D>;
    getRoom(id: number): GameRoom<D> | undefined;
    getRoomByInviteCode(inviteCode: string): GameRoom<D> | undefined;
    destroyRoom(id: number): boolean;
    init(): Promise<void>;
    destroy(): void;
}
