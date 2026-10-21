import { BufferReader } from "@nasselk/binarypack";
import { MessageHandlers } from "../../../shared/networking/handlers";
import { Protocol, SOCKET_ROUTE } from "../../../shared/networking/protocol";
import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { IDAllocator } from "../../../shared/utils/IDAllocator";
import { error, log } from "../../../shared/utils/logger";
import { Interval } from "../../../shared/utils/timers/timer";
import { HttpGate } from "./http";
import { Socket } from "./socket";
export const DEFAULT_NETWORK_SETTINGS = {
    port: 3000,
    proxied: false,
    origins: "*",
    http: {
        maxRequestBodySize: 1024 * 1024,
        maxRequestRate: 30,
    },
    ws: {
        maxConnections: Infinity,
        maxConnectionsPerIP: Infinity,
        maxMessageSize: 1024 * 16,
        maxBackPressure: 1024 * 1024,
        maxMessageRate: Infinity,
        idleTimeout: 0,
    },
};
export class NetworkSystem extends EventEmitter {
    constructor(options) {
        super();
        this.extraRoutes = new Map();
        this.protocol = new Protocol(options);
        this.handlers = new MessageHandlers(this.protocol.in);
        this.settings = this.mergeSettings(options);
        this.sockets = new Map();
        this.IPList = new CounterMap();
        this.socketIDs = new IDAllocator();
        this.http = new HttpGate({
            origins: this.settings.origins,
            proxied: this.settings.proxied,
            maxRequestRate: this.settings.http.maxRequestRate,
            address: (request) => this.server?.requestIP(request)?.address,
        });
        this.limits = this.protocol.in.events.map((event) => NetworkSystem.resolveLimit(event, options?.limits?.[event]));
    }
    init() {
        this.setTimedProtections();
        this.setupWebSocketServer();
    }
    mergeSettings(options) {
        const defaults = DEFAULT_NETWORK_SETTINGS;
        return {
            TLS: options?.TLS,
            port: options?.port ?? defaults.port,
            proxied: options?.proxied ?? defaults.proxied,
            origins: options?.origins ?? defaults.origins,
            http: { ...defaults.http, ...options?.http },
            ws: { ...defaults.ws, ...options?.ws },
        };
    }
    setTimedProtections() {
        const idleTimeout = this.settings.ws.idleTimeout * 1000;
        this.sweep = new Interval(() => {
            const now = performance.now();
            for (const socket of this.sockets.values()) {
                if (idleTimeout > 0 && now - socket.lastMessage >= idleTimeout) {
                    socket.disconnect("Idle timeout", 1001);
                }
                else {
                    socket.resetRates();
                }
            }
            this.http.resetRates();
        }, 1000);
    }
    setupWebSocketServer() {
        const settings = this.settings;
        const certs = settings.TLS
            ? {
                key: Bun.file(Bun.fileURLToPath(settings.TLS.key instanceof URL ? settings.TLS.key : new URL(settings.TLS.key, import.meta.url))),
                cert: Bun.file(Bun.fileURLToPath(settings.TLS.cert instanceof URL ? settings.TLS.cert : new URL(settings.TLS.cert, import.meta.url))),
            }
            : undefined;
        log("Networking Server", `Starting ${settings.TLS ? "secure" : "non-secure"} WebSocket server on port ${settings.port}...`);
        this.server = Bun.serve({
            hostname: "0.0.0.0",
            port: settings.port,
            tls: certs,
            maxRequestBodySize: settings.http.maxRequestBodySize,
            routes: {
                [SOCKET_ROUTE]: {
                    GET: (req, server) => this.handleUpgrade(req, server),
                },
                "/infos": {
                    GET: this.http.route(() => Response.json({
                        players: this.sockets.size,
                        maxPlayers: settings.ws.maxConnections,
                        uptime: process.uptime(),
                    })),
                },
                "/ping": {
                    GET: this.http.route(() => Response.json("pong")),
                },
                ...Object.fromEntries([...this.extraRoutes].map(([path, handler]) => [path, { GET: this.http.route((_, request) => handler(request)) }])),
            },
            fetch: () => new Response("Not Found", { status: 404 }),
            websocket: {
                idleTimeout: settings.ws.idleTimeout,
                maxPayloadLength: settings.ws.maxMessageSize,
                backpressureLimit: settings.ws.maxBackPressure,
                closeOnBackpressureLimit: true,
                open: (ws) => {
                    const data = ws.data;
                    if (this.sockets.size >= settings.ws.maxConnections || this.IPList.getCount(data.ip) >= settings.ws.maxConnectionsPerIP) {
                        ws.close(1013, "Too many connections");
                    }
                    else {
                        this.IPList.increment(data.ip);
                        const socket = (data.socket = new Socket(this.protocol, ws, this.socketIDs.allocate()));
                        this.sockets.set(socket.id, socket);
                        log("Networking Server", `${socket.ip} connected`);
                        this.emit("connection", socket);
                    }
                },
                message: (ws, message) => {
                    const socket = ws.data.socket;
                    if (!socket) {
                        return;
                    }
                    if (typeof message === "string" || message.byteLength === 0) {
                        socket.disconnect("Malformed message", 1003);
                        return;
                    }
                    this.handle(socket, message);
                },
                close: (ws, code, reason) => {
                    const socket = ws.data.socket;
                    if (!socket) {
                        return;
                    }
                    ws.data.socket = undefined;
                    this.sockets.delete(socket.id);
                    this.socketIDs.free(socket.id);
                    this.IPList.decrement(socket.ip);
                    socket.disconnection(code, reason);
                    this.emit("disconnection", socket, code, reason);
                    socket.room?.leave(socket);
                },
            },
            error: (err) => {
                error("Networking Server", `HTTP server error: ${err instanceof Error ? err.message : String(err)}`);
                return new Response("Internal Server Error", { status: 500 });
            },
        });
        log("Networking Server", "Successfully started the WebSocket server.");
        this.emit("listening", this.server.port ?? settings?.port);
    }
    handle(socket, message) {
        socket.lastMessage = performance.now();
        if (++socket.messages > this.settings.ws.maxMessageRate) {
            socket.disconnect("Too many messages", 1008);
            return;
        }
        const reader = new BufferReader(message);
        const code = reader.readUint8();
        const event = this.protocol.in.name(code);
        if (event === undefined) {
            socket.disconnect("Unknown event", 1003);
            return;
        }
        const limit = this.limits[code];
        if (limit && !this.withinLimits(socket, code, limit, reader.byteLength - 1)) {
            return;
        }
        let data;
        try {
            data = this.protocol.decode(event, reader);
        }
        catch {
            socket.disconnect("Malformed message", 1003);
            return;
        }
        try {
            this.handlers.get(code)?.(socket, data);
            this.emit("message", socket, event, data);
        }
        catch (err) {
            error("Networking Server", `Unhandled error while handling "${event}":`, err);
        }
    }
    withinLimits(socket, code, limit, byteLength) {
        if (limit.maxRate !== undefined && socket.rates.increment(code) > limit.maxRate) {
            socket.disconnect("Too many messages", 1008);
            return false;
        }
        if (byteLength < limit.minBytes || byteLength > limit.maxBytes) {
            socket.disconnect("Malformed message", 1003);
            return false;
        }
        return true;
    }
    static resolveLimit(event, limit) {
        if (limit === undefined) {
            return undefined;
        }
        const { byteLength } = limit;
        const [minBytes, maxBytes] = byteLength === undefined ? [0, Infinity] : typeof byteLength === "number" ? [byteLength, byteLength] : byteLength;
        if (!Number.isInteger(minBytes) || minBytes < 0 || !(Number.isInteger(maxBytes) || maxBytes === Infinity) || minBytes > maxBytes) {
            throw new RangeError(`Invalid byteLength for "${event}": expected a non-negative integer or [min, max] with min <= max, got ${JSON.stringify(byteLength)}`);
        }
        return { maxRate: limit.maxRate, minBytes, maxBytes };
    }
    route(path, handler) {
        if (this.server !== undefined) {
            throw new Error(`Route "${path}" added after the server started; add it before init()`);
        }
        this.extraRoutes.set(path, handler);
        return this;
    }
    onMessage(event, callback) {
        return this.handlers.add(event, callback);
    }
    broadcast(topic, event, ...[data]) {
        const buffer = this.protocol.encode(event, data);
        this.server?.publish(topic, buffer);
        return this;
    }
    handleUpgrade(req, server) {
        const refusal = this.http.refuse(req);
        if (refusal) {
            return refusal;
        }
        if (this.sockets.size >= this.settings.ws.maxConnections) {
            return new Response("Server full", { status: 503 });
        }
        if (server.upgrade(req, { data: { ip: this.http.ip(req) } })) {
            return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
    }
    destroy() {
        this.sweep?.clear();
        this.sweep = undefined;
        this.sockets.clear();
        this.IPList.clear();
        this.http.resetRates();
        this.socketIDs.clear();
        this.server?.stop(true);
        log("Networking Server", "Stopped the WebSocket server.");
        this.emit("destroy");
        this.removeAllListeners();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTmV0d29ya1N5c3RlbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NlcnZlci9zcmMvbmV0d29ya2luZy9OZXR3b3JrU3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxZQUFZLEVBQWdCLE1BQU0scUJBQXFCLENBQUM7QUFFakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3RFLE9BQU8sRUFBOEYsUUFBUSxFQUFxQyxZQUFZLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1TSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzFELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxNQUFNLEVBQXVCLE1BQU0sVUFBVSxDQUFDO0FBOEZ2RCxNQUFNLENBQUMsTUFBTSx3QkFBd0IsR0FBb0I7SUFDeEQsSUFBSSxFQUFFLElBQUk7SUFDVixPQUFPLEVBQUUsS0FBSztJQUNkLE9BQU8sRUFBRSxHQUFHO0lBQ1osSUFBSSxFQUFFO1FBQ0wsa0JBQWtCLEVBQUUsSUFBSSxHQUFHLElBQUk7UUFDL0IsY0FBYyxFQUFFLEVBQUU7S0FDbEI7SUFDRCxFQUFFLEVBQUU7UUFDSCxjQUFjLEVBQUUsUUFBUTtRQUN4QixtQkFBbUIsRUFBRSxRQUFRO1FBQzdCLGNBQWMsRUFBRSxJQUFJLEdBQUcsRUFBRTtRQUN6QixlQUFlLEVBQUUsSUFBSSxHQUFHLElBQUk7UUFDNUIsY0FBYyxFQUFFLFFB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