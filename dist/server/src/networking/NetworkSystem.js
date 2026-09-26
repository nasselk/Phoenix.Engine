import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { IDAllocator } from "../../../shared/utils/IDAllocator";
import { error, log, warn } from "../../../shared/utils/logger";
import { Protocol } from "../../../shared/networking/protocol";
import { SESSION_SUBPROTOCOL, SESSION_TTL, TICKET_TTL } from "../../../shared/networking/session";
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
        maxSessions: Infinity,
        maxSessionsPerIP: Infinity,
        maxMessageSize: 1024 * 16,
        maxBackPressure: 1024 * 1024,
        maxMessageRate: Infinity,
        idleTimeout: 0,
    },
};
export class NetworkSystem extends EventEmitter {
    constructor(options) {
        super();
        this.protocol = new Protocol(options);
        this.settings = this.mergeSettings(options);
        this.sockets = new Map();
        this.requestsRate = new CounterMap();
        this.IPList = new CounterMap();
        this.messages = [];
        this.socketIDs = new IDAllocator();
        this.tickets = new Map();
        this.sessions = new Map();
        this.origins = this.setAllowedOrigins(options?.origins ?? "*");
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
    setAllowedOrigins(origins) {
        const list = Array.isArray(origins) ? origins : [origins];
        const allowedOrigins = [];
        if (list.includes("*")) {
            allowedOrigins.push(new RegExp(".*", "i"));
            return allowedOrigins;
        }
        for (const origin of list) {
            let pattern = origin;
            if (pattern.startsWith("*://")) {
                pattern = "(http|https)://" + pattern.slice(4);
            }
            pattern = pattern.replace(/\./g, "\\.");
            pattern = pattern.replace(/\*/g, ".*");
            pattern = `^${pattern}$`;
            allowedOrigins.push(new RegExp(pattern, "i"));
        }
        return allowedOrigins;
    }
    setTimedProtections() {
        const idleTimeout = this.settings.ws.idleTimeout * 1000;
        this.sweep = new Interval(() => {
            const now = performance.now();
            for (const socket of this.sockets.values()) {
                if (idleTimeout > 0 && now - socket.lastMessage >= idleTimeout) {
                    socket.disconnect(false, "Idle timeout", 1001);
                }
                else {
                    socket.resetRates();
                }
            }
            this.requestsRate.clear();
            const wallClock = Date.now();
            for (const [ticket, { expiresAt }] of this.tickets) {
                if (wallClock >= expiresAt) {
                    this.tickets.delete(ticket);
                }
            }
            for (const [sessionID, expiresAt] of this.sessions) {
                if (wallClock >= expiresAt) {
                    this.sessions.delete(sessionID);
                }
            }
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
        try {
            this.server = Bun.serve({
                hostname: "0.0.0.0",
                port: settings.port,
                tls: certs,
                maxRequestBodySize: settings.http.maxRequestBodySize,
                routes: {
                    ["/ws"]: {
                        GET: (req, server) => this.handleUpgrade(req, server),
                    },
                    ["/session/init"]: {
                        OPTIONS: this.preflight(),
                        POST: this.middleware((state) => this.initSession(state)),
                    },
                    "/infos": {
                        GET: this.middleware(() => Response.json({
                            players: this.sockets.size,
                            maxPlayers: settings.ws.maxSessions,
                            uptime: process.uptime(),
                        })),
                    },
                    "/ping": {
                        GET: this.middleware(() => Response.json("pong")),
                    },
                },
                fetch: () => new Response("Not Found", { status: 404 }),
                websocket: {
                    idleTimeout: settings.ws.idleTimeout,
                    maxPayloadLength: settings.ws.maxMessageSize,
                    backpressureLimit: settings.ws.maxBackPressure,
                    closeOnBackpressureLimit: true,
                    open: (ws) => {
                        const data = ws.data;
                        const sessionsCount = this.IPList.getCount(data.ip);
                        if (this.sockets.size >= settings.ws.maxSessions || sessionsCount >= settings.ws.maxSessionsPerIP) {
                            ws.close(1013, "Too many connections");
                        }
                        else {
                            this.IPList.increment(data.ip);
                            const socket = (data.socket = new Socket(this.protocol, ws, this.socketIDs.allocate()));
                            this.sockets.set(socket.id, socket);
                            this.sessions.set(socket.sessionID, Infinity);
                            log("Networking Server", `${socket.ip} connected (session ${socket.sessionID})`);
                            this.emit("connection", socket);
                        }
                    },
                    message: (ws, message) => {
                        const socket = ws.data.socket;
                        if (!socket) {
                            return;
                        }
                        if (typeof message === "string" || message.byteLength === 0) {
                            socket.disconnect(false, "Malformed message", 1003);
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
                        this.sessions.set(socket.sessionID, Date.now() + SESSION_TTL);
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
        catch (err) {
            error("Networking Server", `Failed to start networking server: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    handle(socket, message) {
        socket.lastMessage = performance.now();
        if (++socket.messages > this.settings.ws.maxMessageRate) {
            socket.disconnect(false, "Too many messages", 1008);
            return;
        }
        const reader = new BufferReader(message);
        const code = reader.readUint8();
        const event = this.protocol.in.name(code);
        if (event === undefined) {
            socket.disconnect(false, "Unknown event", 1003);
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
            socket.disconnect(false, "Malformed message", 1003);
            return;
        }
        try {
            this.messages[code]?.(socket, data);
            this.emit("message", socket, event, data);
        }
        catch (err) {
            error("Networking Server", `Unhandled error while handling "${event}":`, err);
        }
    }
    withinLimits(socket, code, limit, byteLength) {
        if (limit.maxRate !== undefined && socket.rates.increment(code) > limit.maxRate) {
            socket.disconnect(false, "Too many messages", 1008);
            return false;
        }
        if (byteLength < limit.minBytes || byteLength > limit.maxBytes) {
            socket.disconnect(false, "Malformed message", 1003);
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
    onMessage(event, callback) {
        this.messages[this.protocol.in.code(event)] = callback;
        return this;
    }
    broadcast(topic, event, ...[data]) {
        const buffer = this.protocol.encode(event, data);
        this.server?.publish(topic, buffer);
        return this;
    }
    handleUpgrade(req, server) {
        const ticket = this.parseTicket(req.headers.get("sec-websocket-protocol"));
        const session = ticket ? this.redeemTicket(ticket) : undefined;
        if (!session) {
            return new Response("Forbidden", { status: 403 });
        }
        if (this.sockets.size >= this.settings.ws.maxSessions) {
            return new Response("Server full", { status: 503 });
        }
        const data = {
            ip: this.getRequestIP(req),
            sessionID: session.sessionID,
            reconnectionToken: this.sessions.has(session.sessionID) ? session.sessionID : undefined,
        };
        if (server.upgrade(req, { data, headers: { "Sec-WebSocket-Protocol": SESSION_SUBPROTOCOL } })) {
            return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
    }
    parseTicket(header) {
        if (!header) {
            return undefined;
        }
        const offered = header.split(",").map((value) => value.trim());
        if (!offered.includes(SESSION_SUBPROTOCOL)) {
            return undefined;
        }
        return offered.find((value) => value !== SESSION_SUBPROTOCOL) || undefined;
    }
    redeemTicket(ticket) {
        const session = this.tickets.get(ticket);
        if (session === undefined) {
            return undefined;
        }
        this.tickets.delete(ticket);
        return Date.now() < session.expiresAt ? session : undefined;
    }
    getRequestIP(req) {
        if (this.settings.proxied) {
            const forwarded = req.headers.get("CF-Connecting-IP");
            if (forwarded) {
                return forwarded.split(",")[0].trim();
            }
        }
        return this.server?.requestIP(req)?.address ?? "";
    }
    middleware(handler) {
        return async (req) => {
            const cors = this.corsHeaders(req.headers.get("origin") ?? "");
            if (!cors) {
                return new Response("Forbidden", { status: 403 });
            }
            return this.withCors(await this.invoke(handler, req), cors);
        };
    }
    async invoke(handler, req) {
        const ip = this.getRequestIP(req);
        if (this.requestsRate.increment(ip) > this.settings.http.maxRequestRate) {
            return new Response("Too many requests", { status: 429 });
        }
        let data;
        if (req.method === "POST") {
            try {
                const body = await req.text();
                data = body.length > 0 ? JSON.parse(body) : {};
            }
            catch {
                return new Response("Invalid JSON", { status: 400 });
            }
        }
        try {
            return await handler({ ip, data }, req);
        }
        catch (err) {
            warn("Networking Server", "Unhandled error in HTTP handler:", err);
            return new Response("Internal Server Error", { status: 500 });
        }
    }
    preflight() {
        return this.middleware(() => new Response(null, { status: 204 }));
    }
    corsHeaders(origin) {
        const allowed = this.origins.some((regex) => regex.test(origin));
        if (!allowed) {
            return null;
        }
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Credentials": "true",
        };
    }
    withCors(response, cors) {
        for (const key in cors) {
            response.headers.set(key, cors[key]);
        }
        return response;
    }
    initSession(state) {
        const body = (state.data ?? {});
        const token = typeof body.reconnectionToken === "string" ? body.reconnectionToken : undefined;
        const allowReconnection = token !== undefined && this.sessions.has(token);
        const sessionID = allowReconnection ? token : crypto.randomUUID();
        const ticket = crypto.randomUUID();
        this.tickets.set(ticket, { sessionID, expiresAt: Date.now() + TICKET_TTL });
        this.sessions.set(sessionID, Date.now() + SESSION_TTL + TICKET_TTL);
        log("Networking Server", `Issued a session ticket to ${state.ip}`);
        return Response.json({ ticket, sessionID, allowReconnection });
    }
    destroy() {
        this.sweep?.clear();
        this.sweep = undefined;
        this.sockets.clear();
        this.tickets.clear();
        this.sessions.clear();
        this.IPList.clear();
        this.requestsRate.clear();
        this.socketIDs.clear();
        this.server?.stop(true);
        log("Networking Server", "Stopped the WebSocket server.");
        this.emit("destroy");
        this.removeAllListeners();
    }
}
