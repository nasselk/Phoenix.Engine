import type { ServerWebSocket } from "bun";
import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { type Contract, type InboundEvent, type MessagePayload, type OutboundEvent, type Protocol, type SendPayload } from "../../../shared/networking/protocol";
import { Seen } from "../world/replication";
import type { World } from "../world/world";
type SocketEvents<C extends Contract> = {
    disconnection: [code: number, reason: string, manual: boolean];
    message: [event: InboundEvent<C>, data: MessagePayload<C, InboundEvent<C>>];
};
export interface SocketData {
}
export type SocketUserData = {
    socket?: Socket<any>;
    readonly ip: string;
    readonly sessionID: string;
    readonly reconnectionToken?: string;
};
export declare const enum SocketState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3
}
export declare class Socket<C extends Contract = Contract> extends EventEmitter<SocketEvents<C>> {
    readonly id: number;
    readonly ip: string;
    readonly sessionID: string;
    readonly reconnectionToken?: string;
    lastMessage: number;
    messages: number;
    readonly rates: CounterMap<number>;
    readonly room?: World<any, any, C>;
    readonly seen: Seen;
    readonly data: SocketData;
    private readonly protocol;
    private readonly socket;
    private manuallyDisconnected;
    constructor(protocol: Protocol<C>, socket: ServerWebSocket<SocketUserData>, id: number);
    send<K extends OutboundEvent<C>>(event: K, ...[data]: SendPayload<C, K>): this;
    broadcast<K extends OutboundEvent<C>>(topic: string, event: K, ...[data]: SendPayload<C, K>): this;
    cork(callback: (socket: this) => void): this;
    subscribe(topic: string): this;
    unsubscribe(topic: string): this;
    resetRates(): void;
    disconnect(forcefully?: true): void;
    disconnect(forcefully?: false, reason?: string, code?: number): void;
    disconnection(code: number, reason: string): void;
    get readyState(): SocketState;
}
export {};
