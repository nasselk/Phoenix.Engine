import type { BunRequest } from "bun";
export type RequestState = {
    readonly ip: string;
    readonly data: unknown;
};
export type RouteHandler = (state: RequestState, request: BunRequest) => Response | Promise<Response>;
export type HttpGateOptions = {
    readonly origins: string[] | string;
    readonly proxied: boolean;
    readonly maxRequestRate: number;
    readonly address: (request: BunRequest) => string | undefined;
};
export declare class HttpGate {
    private readonly options;
    private readonly origins;
    private readonly requests;
    constructor(options: HttpGateOptions);
    route(handler: RouteHandler): (request: BunRequest) => Promise<Response>;
    preflight(): (request: BunRequest) => Promise<Response>;
    ip(request: BunRequest): string;
    resetRates(): void;
    private invoke;
    private corsHeaders;
    private static compileOrigins;
}
