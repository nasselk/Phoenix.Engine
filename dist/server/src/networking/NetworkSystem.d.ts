import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { Protocol, type Contract, type ContractOf, type InboundEvent, type MessagePayload, type OutboundEvent, type SchemasFor, type SendPayload } from "../../../shared/networking/protocol";
import { Socket } from "./socket";
import type { BunRequest } from "bun";
type NetworkSystemEvents<C extends Contract> = {
    listening: [port: number];
    connection: [socket: Socket<C>];
    disconnection: [socket: Socket<C>, code: number, reason: string];
    message: [socket: Socket<C>, event: InboundEvent<C>, data: MessagePayload<C, InboundEvent<C>>];
    destroy: [];
};
export type EventLimit = {
    readonly maxRate?: number;
    readonly byteLength?: number | readonly [min: number, max: number];
};
export type EventLimits<E extends readonly string[]> = Partial<Record<E[number], EventLimit>>;
export type NetworkTransportOptions = {
    readonly TLS?: {
        readonly key: string | URL;
        readonly cert: string | URL;
    };
    readonly port?: number;
    readonly proxied?: boolean;
    readonly origins?: string[] | string;
    readonly http?: {
        readonly maxRequestBodySize?: number;
        readonly maxRequestRate?: number;
    };
    readonly ws?: {
        readonly maxConnections?: number;
        readonly maxConnectionsPerIP?: number;
        readonly maxMessageSize?: number;
        readonly maxBackPressure?: number;
        readonly maxMessageRate?: number;
        readonly idleTimeout?: number;
    };
};
export type NetworkSystemOptions<In extends readonly string[], Out extends readonly string[], InSchemas, OutSchemas> = NetworkTransportOptions & {
    readonly in?: {
        readonly events: In;
        readonly schema?: InSchemas;
    };
    readonly out?: {
        readonly events: Out;
        readonly schema?: OutSchemas;
    };
    readonly limits?: EventLimits<In>;
};
type Filled<T> = {
    readonly [K in keyof T]-?: Exclude<T[K], undefined>;
};
export type NetworkSettings = Filled<Omit<NetworkTransportOptions, "TLS" | "http" | "ws">> & {
    readonly TLS?: NetworkTransportOptions["TLS"];
    readonly http: Filled<NonNullable<NetworkTransportOptions["http"]>>;
    readonly ws: Filled<NonNullable<NetworkTransportOptions["ws"]>>;
};
export declare const DEFAULT_NETWORK_SETTINGS: NetworkSettings;
export declare class NetworkSystem<const In extends readonly string[] = [], const Out extends readonly string[] = [], const InSchemas extends SchemasFor<InSchemas, In> = {}, const OutSchemas extends SchemasFor<OutSchemas, Out> = {}, C extends Contract = ContractOf<In, Out, InSchemas, OutSchemas>> extends EventEmitter<NetworkSystemEvents<C>> {
    readonly protocol: Protocol<C>;
    readonly sockets: Map<number, Socket<C>>;
    readonly IPList: CounterMap<string>;
    readonly settings: NetworkSettings;
    private readonly http;
    private readonly limits;
    private readonly handlers;
    private readonly socketIDs;
    private readonly extraRoutes;
    private sweep?;
    private server?;
    constructor(options?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>);
    init(): void;
    private mergeSettings;
    private setTimedProtections;
    private setupWebSocketServer;
    private handle;
    private withinLimits;
    private static resolveLimit;
    route(path: string, handler: (request: BunRequest) => Response | Promise<Response>): this;
    onMessage<K extends InboundEvent<C>>(event: K, callback: (socket: Socket<C>, data: MessagePayload<C, K>) => void): () => void;
    broadcast<K extends OutboundEvent<C>>(topic: string, event: K, ...[data]: SendPayload<C, K>): this;
    private handleUpgrade;
    destroy(): void;
}
export {};
