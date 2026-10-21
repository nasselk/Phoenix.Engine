type transferable = ArrayBuffer | MessagePort;
export type ThreadMessages = {
    readonly [event: string]: {
        readonly data: unknown;
        readonly response?: unknown;
    };
};
export type ThreadRequestOptions = {
    readonly transfer?: transferable[];
    readonly timeout?: number;
};
type Event<M> = keyof M & string;
type DataOf<M extends ThreadMessages, E extends keyof M> = M[E]["data"];
type ResponseOf<M extends ThreadMessages, E extends keyof M> = M[E]["response"];
type Listener<M extends ThreadMessages, E extends keyof M> = (data: DataOf<M, E>) => void;
type Handler<M extends ThreadMessages, E extends keyof M> = (data: DataOf<M, E>, transfer: transferable[]) => ResponseOf<M, E> | Promise<ResponseOf<M, E>>;
export declare class Thread<M extends ThreadMessages> {
    private readonly endpoint;
    private readonly listeners;
    private readonly handlers;
    private readonly pending;
    private nextRequestID;
    private terminated;
    constructor(endpoint: Worker | MessagePort);
    static parent<M extends ThreadMessages>(): Thread<M>;
    static getChannel(): [MessagePort, MessagePort];
    send<E extends Event<M>>(event: E, data: DataOf<M, E>, transfer?: transferable[]): void;
    on<E extends Event<M>>(event: E, listener: Listener<M, E>): () => void;
    request<E extends Event<M>>(event: E, data: DataOf<M, E>, { transfer, timeout }?: ThreadRequestOptions): Promise<ResponseOf<M, E>>;
    onRequest<E extends Event<M>>(event: E, handler: Handler<M, E>): () => void;
    terminate(): void;
    private receive;
    private answer;
    private settle;
    private rejectPending;
    private post;
}
export {};
//# sourceMappingURL=thread.d.ts.map