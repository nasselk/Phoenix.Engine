import { GameLoop, type GameLoopParams } from "./GameLoop";
import { World } from "./world/world";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import type { ContractOf, SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions, EntityRegistry } from "../../shared/world/registry";
import { EventEmitter } from "../../shared/utils/EventEmitter";
type EngineEvents = {
    init: [];
    destroy: [];
};
export declare const MAX_INVITE_CODE_ATTEMPTS = 100;
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, D extends EntityDefinitions = EntityDefinitions, C = never> = {
    readonly entities: EntityRegistry<D>;
    readonly context?: C;
    readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
    readonly loop?: Partial<GameLoopParams>;
    readonly rooms?: {
        maximum?: number;
    };
};
type ContextOf<C, Self> = [C] extends [never] ? Self : C;
export declare class Engine<const In extends readonly string[] = [], const Out extends readonly string[] = [], const InSchemas extends SchemasFor<InSchemas, In> = {}, const OutSchemas extends SchemasFor<OutSchemas, Out> = {}, const D extends EntityDefinitions = EntityDefinitions, C = never> extends EventEmitter<EngineEvents> {
    readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
    readonly loop: GameLoop;
    readonly rooms: Map<string, World<D, ContextOf<C, this>, ContractOf<In, Out, InSchemas, OutSchemas>>>;
    private readonly entities;
    private readonly maxRooms;
    private readonly context;
    constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, D, C>);
    init(): Promise<void>;
    createRoom(maxPlayers?: number, capacity?: number, inviteCode?: string): World<D, ContextOf<C, this>, ContractOf<In, Out, InSchemas, OutSchemas>>;
    getRoom(inviteCode: string): World<D, ContextOf<C, this>, ContractOf<In, Out, InSchemas, OutSchemas>> | undefined;
    destroyRoom(inviteCode: string): boolean;
    private freeInviteCode;
    destroy(): void;
}
export {};
