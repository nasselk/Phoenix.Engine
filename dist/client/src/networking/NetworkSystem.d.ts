import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { Protocol, type Contract, type ContractOf, type InboundEvent, type MessagePayload, type OutboundEvent, type SchemasFor, type SendPayload } from "../../../shared/networking/protocol";
import { BufferReader } from "@nasselk/binarypack";
type NetworkEvents = {
    connection: [];
    disconnection: [code: number, reason: string, manual: boolean];
    reconnection: [];
    message: [event: string, data: BufferReader];
};
export type NetworkSystemOptions<In extends readonly string[], Out extends readonly string[], InSchemas, OutSchemas> = {
    readonly in?: {
        readonly events: In;
        readonly schema?: InSchemas;
    };
    readonly out?: {
        readonly events: Out;
        readonly schema?: OutSchemas;
    };
    readonly url?: URL | string;
    readonly simulation?: {
        readonly latency?: number;
        readonly loss?: number;
    };
};
export declare enum NetworkState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3
}
export declare class NetworkSystem<const In extends readonly string[] = [], const Out extends readonly string[] = [], const InSchemas extends SchemasFor<InSchemas, In> = {}, const OutSchemas extends SchemasFor<OutSchemas, Out> = {}, C extends Contract = ContractOf<In, Out, InSchemas, OutSchemas>> extends EventEmitter<NetworkEvents> {
    readonly protocol: Protocol<C>;
    private readonly messages;
    private socket?;
    private baseURL?;
    private promise?;
    private reconnectTimeout?;
    private sessionID?;
    private manuallyDisconnected;
    private reconnecting;
    private readonly latency;
    private readonly loss;
    constructor(options?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>);
    private connectDetached;
    connect(url: URL | string, data?: Record<string, unknown>): Promise<WebSocket>;
    disconnect(code?: number, reason?: string): Promise<this>;
    private setupWebSocket;
    send<K extends OutboundEvent<C>>(event: K, ...[data]: SendPayload<C, K>): Promise<this>;
    private handle;
    onMessage<K extends InboundEvent<C>>(event: K, callback: (data: MessagePayload<C, K>) => void): this;
    simulate<K extends InboundEvent<C>>(event: K, data: MessagePayload<C, K>): void;
    private onConnect;
    private onDisconnect;
    destroy(): void;
    get readyState(): NetworkState;
}
export {};
