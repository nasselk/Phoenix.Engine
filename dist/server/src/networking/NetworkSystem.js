import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { IDAllocator } from "../../../shared/utils/IDAllocator";
import { error, log } from "../../../shared/utils/logger";
import { MessageHandlers } from "../../../shared/networking/handlers";
import { Protocol, SOCKET_ROUTE } from "../../../shared/networking/protocol";
import { HttpGate } from "./http";
import { Socket } from "./socket";
import { Interval } from "../../../shared/utils/timers/timer";
import { BufferReader } from "@nasselk/binarypack";
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
