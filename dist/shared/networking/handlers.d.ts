import type { ProtocolChannel } from "./protocol";
export declare class MessageHandlers<Handler extends (...args: any[]) => void> {
    private readonly channel;
    private readonly handlers;
    constructor(channel: ProtocolChannel);
    add(event: string, handler: Handler): () => void;
    get(code: number): Handler | undefined;
}
