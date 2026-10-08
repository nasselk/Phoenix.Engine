import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { IDAllocator } from "../../../shared/utils/IDAllocator";
import { error, log } from "../../../shared/utils/logger";
import { MessageHandlers } from "../../../shared/networking/handlers";
import { PING_CODE, Protocol, type Contract, type ContractOf, type InboundEvent, type MessagePayload, type OutboundEvent, type SchemasFor, type SendPayload } from "../../../shared/networking/protocol";
import { ServerRoutes, SESSION_SUBPROTOCOL, type SessionRequest } from "../../../shared/networking/session";
import { HttpGate, type RequestState } from "./http";
import { SessionManager } from "./sessions";
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

/** The transport half of the options: where to listen, who may connect, and how much each may send. */
export type NetworkTransportOptions = {
	/** Serve over TLS. All or nothing — half a certificate pair is not a configuration. */
	readonly TLS?: {
		readonly key: string | URL;
		readonly cert: string | URL;
	};
	readonly port?: number;
	/**
	 * Behind one reverse proxy (nginx, Cloudflare): take the client address from the last `X-Forwarded-For`
	 * entry, the one the proxy appended, instead of the socket. Earlier entries are whatever the client sent.
	 * Leave it off when players connect directly: the header could then claim any address.
	 */
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
 * Everything the server may declare: the wire contract, the per-event limits, and the transport.
 *
 * `in` is what clients send here, `out` is what this server sends back — the mirror of the client's
 * declaration, where the two swap. `limits` is keyed by the inbound events themselves: a budget only
 * means something for frames that arrive. Everything transport-side is optional;
 * {@link DEFAULT_NETWORK_SETTINGS} fills in the rest at construction.
 */
export type NetworkSystemOptions<In extends readonly string[], Out extends readonly string[], InSchemas, OutSchemas> = NetworkTransportOptions & {
	readonly in?: { readonly events: In; readonly schema?: InSchemas };
	readonly out?: { readonly events: Out; readonly schema?: OutSchemas };
	readonly limits?: EventLimits<In>;
};

type Filled<T> = { readonly [K in keyof T]-?: Exclude<T[K], undefined> };

/**
 * {@link NetworkTransportOptions} once {@link DEFAULT_NETWORK_SETTINGS} has been folded in: nothing
 * optional but TLS, so the hot paths read `settings.ws.maxMessageRate` without a fallback.
 */
export type NetworkSettings = Filled<Omit<NetworkTransportOptions, "TLS" | "http" | "ws">> & {
	readonly TLS?: NetworkTransportOptions["TLS"];
	readonly http: Filled<NonNullable<NetworkTransportOptions["http"]>>;
	readonly ws: Filled<NonNullable<NetworkTransportOptions["ws"]>>;
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
	private readonly http: HttpGate;
	private readonly sessions: SessionManager;
	/** Per-event limits by inbound wire code, so the hot path indexes an array instead of hashing a name. */
	private readonly limits: Array<ResolvedLimit | undefined>;
	private readonly handlers: MessageHandlers<(socket: Socket<C>, data: any) => void>;
	private readonly socketIDs: IDAllocator;
	/** GET routes added with `route`, served next to the built-in ones. */
	private readonly extraRoutes = new Map<string, (request: BunRequest) => Response | Promise<Response>>();
	private sweep?: Interval;
	private server?: Server<SocketUserData>;

	public constructor(options?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>) {
		super();

		this.protocol = new Protocol<C>(options);
		this.handlers = new MessageHandlers(this.protocol.in);
		this.settings = this.mergeSettings(options);
		this.sockets = new Map();
		this.IPList = new CounterMap();
		this.socketIDs = new IDAllocator();
		this.sessions = new SessionManager();
		this.http = new HttpGate({
			origins: this.settings.origins,
			proxied: this.settings.proxied,
			maxRequestRate: this.settings.http.maxRequestRate,
			address: (request) => this.server?.requestIP(request as unknown as Request)?.address,
		});
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

	private setTimedProtections(): void {
		const idleTimeout = this.settings.ws.idleTimeout * 1000;

		// Rate limiter and idle timeout
		this.sweep = new Interval(() => {
			const now = performance.now();

			for (const socket of this.sockets.values()) {
				// 0 is never, as it is for Bun: otherwise every socket would be idle at the first sweep.
				if (idleTimeout > 0 && now - socket.lastMessage >= idleTimeout) {
					socket.disconnect("Idle timeout", 1001);
				} else {
					socket.resetRates();
				}
			}

			this.http.resetRates();
			this.sessions.sweep();
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
					OPTIONS: this.http.preflight(),
					POST: this.http.route((state) => this.initSession(state)),
				},
				"/infos": {
					GET: this.http.route(() =>
						Response.json({
							players: this.sockets.size,
							maxPlayers: settings.ws.maxSessions,
							uptime: process.uptime(),
						}),
					),
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

				open: (ws): void => {
					const data = ws.data;
					const sessionsCount = this.IPList.getCount(data.ip);

					if (this.sockets.size >= settings.ws.maxSessions || sessionsCount >= settings.ws.maxSessionsPerIP) {
						ws.close(1013, "Too many connections"); // 1013 = Try Again Later
					} else if (!this.sessions.connect(data.sessionID)) {
						ws.close(1008, "Session already connected");
					} else {
						this.IPList.increment(data.ip);

						const socket = (data.socket = new Socket<C>(this.protocol, ws, this.socketIDs.allocate()));

						this.sockets.set(socket.id, socket);

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
						socket.disconnect("Malformed message", 1003);

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
					this.sessions.disconnect(socket.sessionID);

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
	}

	/**
	 * Vet one frame and route it. Everything here runs on input from the network, so each step
	 * either passes or ends the connection — a handler only ever sees a frame that survived all of it.
	 */
	private handle(socket: Socket<C>, message: Buffers): void {
		socket.lastMessage = performance.now();

		if (++socket.messages > this.settings.ws.maxMessageRate) {
			socket.disconnect("Too many messages", 1008);

			return;
		}

		const reader = new BufferReader(message);
		const code = reader.readUint8();

		if (code === PING_CODE) {
			socket.answerPing();

			return;
		}

		const event = this.protocol.in.name(code);

		// An event this server never declared: either a stale client or someone poking at the wire.
		if (event === undefined) {
			socket.disconnect("Unknown event", 1003);

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
			socket.disconnect("Malformed message", 1003);

			return;
		}

		try {
			this.handlers.get(code)?.(socket, data);

			this.emit("message", socket, event, data);
		} catch (err) {
			// A throwing handler is the server's bug, not the client's — log it and keep serving.
			error("Networking Server", `Unhandled error while handling "${event}":`, err);
		}
	}

	/** Per-event rate and size checks. Disconnects and returns false when the frame is out of bounds. */
	private withinLimits(socket: Socket<C>, code: number, limit: ResolvedLimit, byteLength: number): boolean {
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
	 * Serve a GET route next to the built-in ones, with the same CORS and rate limits. The path can have
	 * parameters (`/rooms/:code`), read from `request.params`. Added before
	 * `init`, which is when the server starts listening.
	 */
	public route(path: string, handler: (request: BunRequest) => Response | Promise<Response>): this {
		if (this.server !== undefined) {
			throw new Error(`Route "${path}" added after the server started; add it before init()`);
		}

		this.extraRoutes.set(path, handler);

		return this;
	}

	/**
	 * Registers the handler for an incoming event.
	 *
	 * One handler per event, since a raw reader can only be read once: registering a second throws.
	 * Listen on the `message` event instead when several places need to see the same traffic.
	 *
	 * @param event The event to listen for. Must be one of the names declared in `settings.in.events`.
	 * @param callback Receives the sending socket, then the decoded data when the event has an
	 *   inbound schema or the raw reader otherwise.
	 * @returns A function that removes the handler, so another can be registered.
	 */
	public onMessage<K extends InboundEvent<C>>(event: K, callback: (socket: Socket<C>, data: MessagePayload<C, K>) => void): () => void {
		return this.handlers.add(event, callback);
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
		const ticket = this.sessions.ticketFrom(req.headers.get("sec-websocket-protocol"));
		const session = ticket ? this.sessions.redeem(ticket) : undefined;

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
			ip: this.http.ip(req),
			sessionID: session.sessionID,
			reconnectionToken: session.reconnected ? session.sessionID : undefined,
		};

		// On success Bun owns the socket and we must NOT return a Response. Echo back only the
		// protocol name (never the ticket) so the browser completes the handshake.
		if (server.upgrade(req as unknown as Request, { data, headers: { "Sec-WebSocket-Protocol": SESSION_SUBPROTOCOL } })) {
			return undefined;
		}

		return new Response("WebSocket upgrade failed", { status: 500 });
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

		log("Networking Server", `Issued a session ticket to ${state.ip}`);

		return Response.json(this.sessions.issue(token));
	}

	/** Close every connection and stop listening. The instance is not reusable afterwards. */
	public destroy(): void {
		this.sweep?.clear();
		this.sweep = undefined;

		this.sockets.clear();
		this.sessions.clear();
		this.IPList.clear();
		this.http.resetRates();
		this.socketIDs.clear();

		this.server?.stop(true);

		log("Networking Server", "Stopped the WebSocket server.");

		this.emit("destroy");

		this.removeAllListeners();
	}
}
