import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { IDAllocator } from "../../../shared/utils/IDAllocator";
import { error, log, warn } from "../../../shared/utils/logger";
import { Protocol, type Contract, type ContractOf, type InboundEvent, type MessagePayload, type OutboundEvent, type SchemasFor, type SendPayload } from "../../../shared/networking/protocol";
import { ServerRoutes, SESSION_SUBPROTOCOL, SESSION_TTL, TICKET_TTL, type SessionRequest, type SessionResponse } from "../../../shared/networking/session";
import { Socket, type SocketUserData } from "./socket";
import { Interval } from "../../../shared/utils/timers/timer";
import type { BunRequest, Server } from "bun";
import { BufferReader, type Buffers } from "@nasselk/binarypack";

type NetworkSystemEvents<C extends Contract> = {
	listening: [port: number];
	connection: [socket: Socket<C>];
	disconnection: [socket: Socket<C>, code: number, reason: string];
	message: [socket: Socket<C>, event: InboundEvent<C>, data: MessagePayload<C, InboundEvent<C>>];
	destroy: [];
};

/** Per-event budget, checked against untrusted input before a handler ever sees it. */
export type EventLimit = {
	/** Max frames of this event per second. Over it, the connection is closed. */
	readonly maxRate?: number;
	/**
	 * Payload size in bytes, event code excluded. A frame outside it is malformed by definition.
	 *
	 * A number is an exact size — `0` for an event that carries nothing — and `[min, max]` is a
	 * range, both ends included.
	 */
	readonly byteLength?: number | readonly [min: number, max: number];
};

/** An EventLimit with its size already resolved to two bounds, so a frame is checked with two comparisons. */
type ResolvedLimit = {
	readonly maxRate?: number;
	readonly minBytes: number;
	readonly maxBytes: number;
};

export type EventLimits<E extends readonly string[]> = Partial<Record<E[number], EventLimit>>;

/**
 * Everything the server may declare: the wire contract, the transport, and the per-event limits.
 *
 * `in` is what clients send here, `out` is what this server sends back — the mirror of the client's
 * declaration, where the two swap. Each direction carries its own event list, so the vocabulary a
 * client may speak is not the one the server answers with.
 *
 * This is a plain object type, which is the point: the constructor checks an object literal against
 * it, so an unknown key is an ordinary excess property, `schema` is constrained to the events beside
 * it, and `limits` is keyed by the inbound events themselves — a budget only means something for
 * frames that arrive. Everything transport-side is optional; {@link DEFAULT_NETWORK_SETTINGS} fills
 * in the rest at construction.
 */
export type NetworkSystemOptions<In extends readonly string[], Out extends readonly string[], InSchemas, OutSchemas> = {
	readonly in?: { readonly events: In; readonly schema?: InSchemas };
	readonly out?: { readonly events: Out; readonly schema?: OutSchemas };
	readonly limits?: EventLimits<In>;
	/** Serve over TLS. All or nothing — half a certificate pair is not a configuration. */
	readonly TLS?: {
		readonly key: string | URL;
		readonly cert: string | URL;
	};
	readonly port?: number;
	/** Behind a reverse proxy: take the client address from the forwarding header instead of the socket. */
	readonly proxied?: boolean;
	readonly origins?: string[] | string;
	/** Budgets for the plain HTTP routes — the session handshake and the status endpoints. */
	readonly http?: {
		readonly maxRequestBodySize?: number;
		/** Requests per IP per second across those routes. Over it, 429. */
		readonly maxRequestRate?: number;
	};
	/** Budgets for the socket half, once a ticket has been redeemed. */
	readonly ws?: {
		/** Process-wide connection cap, also what `/infos` reports as `maxPlayers`. */
		readonly maxSessions?: number;
		readonly maxSessionsPerIP?: number;
		readonly maxMessageSize?: number;
		/** Unflushed send bytes per socket. A client that cannot keep up is dropped rather than buffered. */
		readonly maxBackPressure?: number;
		/** Frames per socket per second, counted before decode. The `limits` budgets sit on top of this one. */
		readonly maxMessageRate?: number;
		/** Seconds, matching Bun's own units. The idle sweep converts to ms. */
		readonly idleTimeout?: number;
	};
};

/**
 * {@link NetworkSystemOptions} once {@link DEFAULT_NETWORK_SETTINGS} has been folded in: no optional
 * keys, so the hot paths read `this.settings.ws.maxMessageRate` without a fallback at every use.
 *
 * Kept in step with the options type by `mergeSettings`, which cannot compile unless every field
 * here has somewhere to come from.
 */
export type NetworkSettings = {
	readonly TLS?: {
		readonly key: string | URL;
		readonly cert: string | URL;
	};
	readonly port: number;
	readonly proxied: boolean;
	readonly origins: string[] | string;
	readonly http: {
		readonly maxRequestBodySize: number;
		readonly maxRequestRate: number;
	};
	readonly ws: {
		readonly maxSessions: number;
		readonly maxSessionsPerIP: number;
		readonly maxMessageSize: number;
		readonly maxBackPressure: number;
		readonly maxMessageRate: number;
		readonly idleTimeout: number;
	};
};

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
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

type RequestState = {
	readonly ip: string;
	readonly data: unknown;
};

/** An unredeemed ticket: the identity it will confer, and when it stops being worth anything. */
type Ticket = {
	readonly sessionID: string;
	readonly expiresAt: number;
};

export class NetworkSystem<
	const In extends readonly string[] = [],
	const Out extends readonly string[] = [],
	const InSchemas extends SchemasFor<InSchemas, In> = {},
	const OutSchemas extends SchemasFor<OutSchemas, Out> = {},
	// Never passed: an alias, so everything below reads `C` rather than the four pieces it is built from.
	C extends Contract = ContractOf<In, Out, InSchemas, OutSchemas>,
> extends EventEmitter<NetworkSystemEvents<C>> {
	/** The two event ⇄ code tables plus the framing. The client builds the mirror of it. */
	public readonly protocol: Protocol<C>;
	public readonly sockets: Map<number, Socket<C>>;
	public readonly IPList: CounterMap<string>;
	public readonly settings: NetworkSettings;
	private readonly requestsRate: CounterMap<string>;
	private readonly origins: RegExp[];
	/** Per-event limits by inbound wire code, so the hot path indexes an array instead of hashing a name. */
	private readonly limits: Array<ResolvedLimit | undefined>;
	/** Handlers registered through {@link onMessage}, indexed by inbound wire code. */
	private readonly messages: Array<(socket: Socket<C>, data: any) => void>;
	private readonly socketIDs: IDAllocator;
	/** Unredeemed tickets, keyed by uuid. Swept every second. */
	private readonly tickets: Map<string, Ticket>;
	/** Known session ids, valued by the epoch ms they stop being reclaimable (`Infinity` while connected). */
	private readonly sessions: Map<string, number>;
	private sweep?: Interval;
	private server?: Server<SocketUserData>;

	public constructor(options?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>) {
		super();

		this.protocol = new Protocol<C>(options);
		this.settings = this.mergeSettings(options);
		this.sockets = new Map();
		this.requestsRate = new CounterMap();
		this.IPList = new CounterMap();
		this.messages = [];
		this.socketIDs = new IDAllocator();
		this.tickets = new Map();
		this.sessions = new Map();
		this.origins = this.setAllowedOrigins(options?.origins ?? "*");
		this.limits = this.protocol.in.events.map((event) => NetworkSystem.resolveLimit(event, (options?.limits as Record<string, EventLimit> | undefined)?.[event]));
	}

	public init(): void {
		this.setTimedProtections();
		this.setupWebSocketServer();
	}

	/** Defaults, then whatever the caller declared alongside the contract. */
	private mergeSettings(options?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>): NetworkSettings {
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

	private setAllowedOrigins(origins: string[] | string): RegExp[] {
		const list = Array.isArray(origins) ? origins : [origins];

		const allowedOrigins: RegExp[] = [];

		if (list.includes("*")) {
			allowedOrigins.push(new RegExp(".*", "i"));

			return allowedOrigins;
		}

		for (const origin of list) {
			let pattern = origin;

			// Special handling for protocol wildcard
			if (pattern.startsWith("*://")) {
				pattern = "(http|https)://" + pattern.slice(4);
			}

			// Convert all dots to escaped dots for regex
			pattern = pattern.replace(/\./g, "\\.");

			// Convert all remaining asterisks to regex wildcards
			pattern = pattern.replace(/\*/g, ".*");

			// Add regex anchors
			pattern = `^${pattern}$`;

			allowedOrigins.push(new RegExp(pattern, "i"));
		}

		return allowedOrigins;
	}

	private setTimedProtections(): void {
		const idleTimeout = this.settings.ws.idleTimeout * 1000;

		// Rate limiter and idle timeout
		this.sweep = new Interval(() => {
			const now = performance.now();

			for (const socket of this.sockets.values()) {
				// 0 is never, as it is for Bun: otherwise every socket would be idle at the first sweep.
				if (idleTimeout > 0 && now - socket.lastMessage >= idleTimeout) {
					socket.disconnect(false, "Idle timeout", 1001);
				} else {
					socket.resetRates();
				}
			}

			this.requestsRate.clear();

			// Wall clock, not performance.now(), because that is what the expiries were written against.
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

	private setupWebSocketServer(): void {
		const settings = this.settings;

		const certs = settings.TLS
			? {
					key: Bun.file(Bun.fileURLToPath(settings.TLS.key instanceof URL ? settings.TLS.key : new URL(settings.TLS.key, import.meta.url))),
					cert: Bun.file(Bun.fileURLToPath(settings.TLS.cert instanceof URL ? settings.TLS.cert : new URL(settings.TLS.cert, import.meta.url))),
				}
			: undefined;

		log("Networking Server", `Starting ${settings.TLS ? "secure" : "non-secure"} WebSocket server on port ${settings.port}...`);

		try {
			this.server = Bun.serve<SocketUserData, string>({
				hostname: "0.0.0.0",
				port: settings.port,
				tls: certs,
				maxRequestBodySize: settings.http.maxRequestBodySize,

				routes: {
					[ServerRoutes.WS]: {
						GET: (req: BunRequest, server: Server<SocketUserData>) => this.handleUpgrade(req, server),
					},
					[ServerRoutes.SESSION]: {
						OPTIONS: this.preflight(),
						POST: this.middleware((state) => this.initSession(state)),
					},
					"/infos": {
						GET: this.middleware(() =>
							Response.json({
								players: this.sockets.size,
								maxPlayers: settings.ws.maxSessions,
								uptime: process.uptime(),
							}),
						),
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

					open: (ws): void => {
						const data = ws.data;
						const sessionsCount = this.IPList.getCount(data.ip);

						if (this.sockets.size >= settings.ws.maxSessions || sessionsCount >= settings.ws.maxSessionsPerIP) {
							ws.close(1013, "Too many connections"); // 1013 = Try Again Later
						} else {
							this.IPList.increment(data.ip);

							const socket = (data.socket = new Socket<C>(this.protocol, ws, this.socketIDs.allocate()));

							this.sockets.set(socket.id, socket);
							// Held for as long as the connection lives, so a reconnect can reclaim the id.
							this.sessions.set(socket.sessionID, Infinity);

							log("Networking Server", `${socket.ip} connected (session ${socket.sessionID})`);

							this.emit("connection", socket);
						}
					},

					message: (ws, message): void => {
						const socket = ws.data.socket as Socket<C> | undefined;

						if (!socket) {
							return;
						}

						// Binary frames arrive as a Buffer; strings and empty frames are malformed for us.
						if (typeof message === "string" || message.byteLength === 0) {
							socket.disconnect(false, "Malformed message", 1003);

							return;
						}

						this.handle(socket, message);
					},

					close: (ws, code, reason): void => {
						const socket = ws.data.socket as Socket<C> | undefined;

						if (!socket) {
							return;
						}

						ws.data.socket = undefined;

						this.sockets.delete(socket.id);
						this.socketIDs.free(socket.id);
						this.IPList.decrement(socket.ip);
						// The id stays claimable for a while so a dropped client keeps its identity.
						this.sessions.set(socket.sessionID, Date.now() + SESSION_TTL);

						socket.disconnection(code, reason);

						this.emit("disconnection", socket, code, reason);

						// After the game's own handlers, which may still need to know the room it was in.
						socket.room?.leave(socket);
					},
				},

				error: (err): Response => {
					error("Networking Server", `HTTP server error: ${err instanceof Error ? err.message : String(err)}`);

					return new Response("Internal Server Error", { status: 500 });
				},
			});

			log("Networking Server", "Successfully started the WebSocket server.");

			this.emit("listening", this.server.port ?? settings?.port);
		} catch (err) {
			error("Networking Server", `Failed to start networking server: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/**
	 * Vet one frame and route it. Everything here runs on input from the network, so each step
	 * either passes or ends the connection — a handler only ever sees a frame that survived all of it.
	 */
	private handle(socket: Socket<C>, message: Buffers): void {
		socket.lastMessage = performance.now();

		if (++socket.messages > this.settings.ws.maxMessageRate) {
			socket.disconnect(false, "Too many messages", 1008);

			return;
		}

		const reader = new BufferReader(message);
		const code = reader.readUint8();
		const event = this.protocol.in.name(code);

		// An event this server never declared: either a stale client or someone poking at the wire.
		if (event === undefined) {
			socket.disconnect(false, "Unknown event", 1003);

			return;
		}

		const limit = this.limits[code];

		if (limit && !this.withinLimits(socket, code, limit, reader.byteLength - 1)) {
			return;
		}

		let data: any;

		try {
			data = this.protocol.decode(event, reader);
		} catch {
			// A payload that does not fit its own schema cannot be acted on, and the client that
			// sent it is out of step with this server.
			socket.disconnect(false, "Malformed message", 1003);

			return;
		}

		try {
			this.messages[code]?.(socket, data);

			this.emit("message", socket, event, data);
		} catch (err) {
			// A throwing handler is the server's bug, not the client's — log it and keep serving.
			error("Networking Server", `Unhandled error while handling "${event}":`, err);
		}
	}

	/** Per-event rate and size checks. Disconnects and returns false when the frame is out of bounds. */
	private withinLimits(socket: Socket<C>, code: number, limit: ResolvedLimit, byteLength: number): boolean {
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

	/**
	 * Turn a declared limit into the two bounds the hot path compares against, rejecting a size that
	 * could never match a frame — better a crash at startup than a server that drops every message.
	 */
	private static resolveLimit(event: string, limit: EventLimit | undefined): ResolvedLimit | undefined {
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

	/**
	 * Registers a handler for an incoming event.
	 *
	 * One handler per event: registering again replaces it. Listen on the `message` event instead
	 * when several places need to see the same traffic.
	 *
	 * @param event The event to listen for. Must be one of the names declared in `settings.in.events`.
	 * @param callback Receives the sending socket, then the decoded data when the event has an
	 *   inbound schema or the raw reader otherwise.
	 */
	public onMessage<K extends InboundEvent<C>>(event: K, callback: (socket: Socket<C>, data: MessagePayload<C, K>) => void): this {
		this.messages[this.protocol.in.code(event)] = callback;

		return this;
	}

	/**
	 * Sends an event to every connected client.
	 *
	 * Framed once and reused for every socket, so a broadcast costs one encode, not one per player.
	 *
	 * @param topic The pub/sub topic to publish to. Every socket that subscribed to it will receive the message.
	 * @param event The event to send. Must be one of the names declared in `settings.out.events`.
	 * @param data The payload. Encoded data when the event has an outbound schema, an optional buffer otherwise.
	 */
	public broadcast<K extends OutboundEvent<C>>(topic: string, event: K, ...[data]: SendPayload<C, K>): this {
		const buffer = this.protocol.encode(event, data);

		this.server?.publish(topic, buffer);

		return this;
	}

	/** Validate a WebSocket upgrade (ticket, capacity) then hand the socket to Bun. */
	private handleUpgrade(req: BunRequest, server: Server<SocketUserData>): Response | undefined {
		const ticket = this.parseTicket(req.headers.get("sec-websocket-protocol"));
		const session = ticket ? this.redeemTicket(ticket) : undefined;

		// No ticket, unknown ticket, or one that sat around too long all get the same answer, so a
		// prober learns nothing about which it was.
		if (!session) {
			return new Response("Forbidden", { status: 403 });
		}

		// Cheap rejection before the handshake. `open` checks again, per IP, once Bun owns the socket.
		if (this.sockets.size >= this.settings.ws.maxSessions) {
			return new Response("Server full", { status: 503 });
		}

		const data: SocketUserData = {
			ip: this.getRequestIP(req),
			sessionID: session.sessionID,
			reconnectionToken: this.sessions.has(session.sessionID) ? session.sessionID : undefined,
		};

		// On success Bun owns the socket and we must NOT return a Response. Echo back only the
		// protocol name (never the ticket) so the browser completes the handshake.
		if (server.upgrade(req as unknown as Request, { data, headers: { "Sec-WebSocket-Protocol": SESSION_SUBPROTOCOL } })) {
			return undefined;
		}

		return new Response("WebSocket upgrade failed", { status: 500 });
	}

	/**
	 * Pull the ticket out of the offered subprotocols. The client offers
	 * `[SESSION_SUBPROTOCOL, <uuid>]`, so the ticket is the entry that isn't the protocol name.
	 */
	private parseTicket(header: string | null): string | undefined {
		if (!header) {
			return undefined;
		}

		const offered = header.split(",").map((value) => value.trim());

		if (!offered.includes(SESSION_SUBPROTOCOL)) {
			return undefined;
		}

		return offered.find((value) => value !== SESSION_SUBPROTOCOL) || undefined;
	}

	/**
	 * Spend a ticket. It is dropped on the first look either way, so one ticket opens exactly one
	 * socket: a second upgrade presenting the same uuid finds nothing.
	 */
	private redeemTicket(ticket: string): Ticket | undefined {
		const session = this.tickets.get(ticket);

		if (session === undefined) {
			return undefined;
		}

		this.tickets.delete(ticket);

		return Date.now() < session.expiresAt ? session : undefined;
	}

	private getRequestIP(req: BunRequest): string {
		if (this.settings.proxied) {
			// Behind a reverse proxy: trust the left-most entry (the real client).
			const forwarded = req.headers.get("CF-Connecting-IP");

			if (forwarded) {
				return forwarded.split(",")[0]!.trim();
			}
		}

		return this.server?.requestIP(req as unknown as Request)?.address ?? "";
	}

	private middleware(handler: (state: RequestState, req: BunRequest) => Response | Promise<Response>): (req: BunRequest) => Promise<Response> {
		return async (req: BunRequest): Promise<Response> => {
			const cors = this.corsHeaders(req.headers.get("origin") ?? "");

			if (!cors) {
				return new Response("Forbidden", { status: 403 });
			}

			return this.withCors(await this.invoke(handler, req), cors);
		};
	}

	/** Rate-limit, decode the body, run the handler. Always resolves; never throws. */
	private async invoke(handler: (state: RequestState, req: BunRequest) => Response | Promise<Response>, req: BunRequest): Promise<Response> {
		const ip = this.getRequestIP(req);

		if (this.requestsRate.increment(ip) > this.settings.http.maxRequestRate) {
			return new Response("Too many requests", { status: 429 });
		}

		let data: unknown;

		if (req.method === "POST") {
			try {
				const body = await req.text();

				data = body.length > 0 ? JSON.parse(body) : {};
			} catch {
				return new Response("Invalid JSON", { status: 400 });
			}
		}

		try {
			return await handler({ ip, data }, req);
		} catch (err) {
			warn("Networking Server", "Unhandled error in HTTP handler:", err);

			return new Response("Internal Server Error", { status: 500 });
		}
	}

	private preflight(): (req: BunRequest) => Promise<Response> {
		return this.middleware(() => new Response(null, { status: 204 }));
	}

	/** Build the CORS headers for an allowed origin, or `null` if the origin isn't allow-listed. */
	private corsHeaders(origin: string): Record<string, string> | null {
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

	/** Merge CORS headers into a response (Bun lets us set headers after the body, unlike uWS). */
	private withCors(response: Response, cors: Record<string, string>): Response {
		for (const key in cors) {
			response.headers.set(key, cors[key]!);
		}

		return response;
	}

	/**
	 * Hand out a ticket. It is the whole credential: hold it, redeem it within the TTL, get a socket.
	 *
	 * A client that still holds a session id from a dropped connection gets it back instead of a new
	 * one, which is what lets a game rejoin a player to what they were doing.
	 */
	private initSession(state: RequestState): Response {
		const body = (state.data ?? {}) as SessionRequest;
		const token = typeof body.reconnectionToken === "string" ? body.reconnectionToken : undefined;
		const allowReconnection = token !== undefined && this.sessions.has(token);
		const sessionID = allowReconnection ? token : crypto.randomUUID();
		const ticket = crypto.randomUUID();

		this.tickets.set(ticket, { sessionID, expiresAt: Date.now() + TICKET_TTL });
		this.sessions.set(sessionID, Date.now() + SESSION_TTL + TICKET_TTL);

		log("Networking Server", `Issued a session ticket to ${state.ip}`);

		return Response.json({ ticket, sessionID, allowReconnection } satisfies SessionResponse);
	}

	/** Close every connection and stop listening. The instance is not reusable afterwards. */
	public destroy(): void {
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
