import { error, log } from "../../../shared/utils/logger";

import { Timeout } from "../../../shared/utils/timers/timer";

import { wait } from "../../../shared/utils/timers/wait";

import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { post } from "../../../shared/utils/fetch";
import { Protocol, type Contract, type ContractOf, type InboundEvent, type MessagePayload, type OutboundEvent, type SchemasFor, type SendPayload } from "../../../shared/networking/protocol";
import { SESSION_ROUTE, SESSION_SUBPROTOCOL, WS_ROUTE, type SessionResponse } from "../../../shared/networking/session";
import { BufferReader, type Buffers } from "@nasselk/binarypack";

type NetworkEvents = {
	connection: [];
	disconnection: [code: number, reason: string, manual: boolean];
	reconnection: [];
	message: [event: string, data: BufferReader];
};

/**
 * Everything the client may declare: the wire contract, and the transport alongside it.
 *
 * This is a plain object type, which is the point — the constructor checks an object literal
 * against it, so an unknown key is an ordinary excess property and `schema` is constrained to the
 * events sitting beside it. Nothing here has to be re-checked after the fact.
 */
export type NetworkSystemOptions<In extends readonly string[], Out extends readonly string[], InSchemas, OutSchemas> = {
	readonly in?: { readonly events: In; readonly schema?: InSchemas };
	readonly out?: { readonly events: Out; readonly schema?: OutSchemas };
	/** Base URL of the server, e.g. `http://localhost:3000`. Given here, the system connects as soon as it is constructed. */
	readonly url?: URL | string;
	readonly simulation?: {
		/** Artificial round-trip latency in ms, applied as half on send and half on receive. Develop against something worse than localhost. */
		readonly latency?: number;
		/** Artificial packet loss: the chance in `[0, 1]` that any one message is silently dropped. */
		readonly loss?: number;
	};
};

export enum NetworkState {
	CONNECTING,
	OPEN,
	CLOSING,
	CLOSED,
}

export class NetworkSystem<
	const In extends readonly string[] = [],
	const Out extends readonly string[] = [],
	const InSchemas extends SchemasFor<InSchemas, In> = {},
	const OutSchemas extends SchemasFor<OutSchemas, Out> = {},
	// Never passed: an alias, so everything below reads `C` rather than the four pieces it is built from.
	C extends Contract = ContractOf<In, Out, InSchemas, OutSchemas>,
> extends EventEmitter<NetworkEvents> {
	public readonly protocol: Protocol<C>;
	private readonly messages: Array<(data: any) => void>;
	private socket?: WebSocket | null;
	private baseURL?: string;
	private promise?: Promise<WebSocket>;
	private reconnectTimeout?: Timeout;
	private sessionID?: string | null;
	private manuallyDisconnected: boolean;
	private reconnecting: boolean;
	private readonly latency: number;
	private readonly loss: number;

	public constructor(options?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>) {
		super();

		this.protocol = new Protocol<C>(options);
		this.messages = [];
		this.manuallyDisconnected = false;
		this.reconnecting = false;
		this.latency = options?.simulation?.latency ?? 0;
		this.loss = options?.simulation?.loss ?? 0;

		if (options?.url) {
			this.connectDetached(options.url);
		}
	}

	/** `connect()` is called from places that cannot await it — surface the failure rather than
	 *  leaving an unhandled rejection behind. */
	private connectDetached(url: URL | string): void {
		this.connect(url).catch((err) => {
			error("Network", "Connection failed:", err instanceof Error ? err.message : err);
		});
	}

	/**
	 * Connects to the server: mints a session ticket over HTTP, then redeems it on the upgrade.
	 *
	 * @param url Base URL of the server, e.g. `http://localhost:3000`. `ws(s)://` is derived from it.
	 * @param data Extra fields to send along with the session request (a join code, a token, ...).
	 *
	 * @returns A promise that resolves to the WebSocket instance when the connection is established.
	 */
	public async connect(url: URL | string, data?: Record<string, unknown>): Promise<WebSocket> {
		await this.disconnect();

		// A trailing slash would double up against the route, which starts with one.
		const baseURL = (this.baseURL = (url instanceof URL ? url.toString() : url).replace(/\/+$/, ""));

		const response = await post<SessionResponse>(baseURL, SESSION_ROUTE, {
			reconnectionToken: this.sessionID ?? null,
			...data,
		});

		if (!response.success) {
			throw new Error(`Failed to initialize session: ${response.error?.message ?? "unknown error"}`);
		}

		const session = response.data;

		this.sessionID = session.sessionID;
		this.reconnecting = session.allowReconnection;

		// http -> ws, https -> wss. Anchored so a host containing "http" is left alone.
		return this.setupWebSocket(baseURL.replace(/^http/, "ws") + WS_ROUTE, session.ticket);
	}

	/**
	 * Disconnects from the WebSocket server.
	 *
	 * @param code The close code.
	 * @param reason The close reason.
	 *
	 * @returns A promise that resolves when the disconnection is complete.
	 */
	public async disconnect(code?: number, reason?: string): Promise<this> {
		// A pending retry would otherwise reconnect right after a deliberate disconnect.
		this.reconnectTimeout?.clear();
		this.reconnectTimeout = undefined;

		return new Promise((resolve) => {
			if (this.readyState === NetworkState.CONNECTING || this.readyState === NetworkState.OPEN) {
				this.socket?.addEventListener(
					"close",
					() => {
						resolve(this);
					},
					{ once: true },
				);

				this.manuallyDisconnected = true;

				this.socket?.close(code, reason);
			} else {
				resolve(this);
			}
		});
	}

	/**
	 * Opens the socket, offering the ticket as the second subprotocol.
	 *
	 * The credential rides on the handshake rather than in the URL or a cookie: query strings end
	 * up in access logs, and mobile browsers drop third-party cookies inside iframes.
	 */
	private setupWebSocket(url: string, ticket: string): Promise<WebSocket> {
		const socket = (this.socket = new WebSocket(url, [SESSION_SUBPROTOCOL, ticket]));
		socket.binaryType = "arraybuffer";

		let opened = false;

		this.promise = new Promise((resolve, reject) => {
			socket.addEventListener("open", () => {
				opened = true;

				resolve(socket);

				this.onConnect();
			});

			socket.addEventListener("message", async (message: MessageEvent) => {
				await this.handle(message.data);
			});

			socket.addEventListener("close", (event: CloseEvent) => {
				if (!opened) {
					reject(new Error(`WebSocket closed before opening (code ${event.code}${event.reason ? `: ${event.reason}` : ""})`));
				}

				this.onDisconnect(event.code, event.reason);
			});
		});

		return this.promise;
	}

	/**
	 * Sends an event to the server.
	 *
	 * @param event The event to send. Must be one of the names declared in `settings.out.events`.
	 * @param data The payload. Encoded data when the event has an outbound schema, an optional buffer otherwise.
	 */
	public async send<K extends OutboundEvent<C>>(event: K, ...[data]: SendPayload<C, K>): Promise<this> {
		if (this.readyState === NetworkState.CONNECTING) {
			await this.promise;
		}

		if (this.readyState !== NetworkState.OPEN) {
			throw new Error("Cannot send message when socket is not open");
		}

		const buffer = this.protocol.encode(event, data);

		if (this.loss > 0 && Math.random() <= this.loss) {
			return this;
		}

		if (this.latency > 0) {
			await wait(this.latency / 2);
		}

		// The socket can close while the simulated latency is being waited out.
		if (this.readyState === NetworkState.OPEN) {
			this.socket!.send(buffer);
		}

		return this;
	}

	private async handle(data: Buffers): Promise<this> {
		if (this.loss > 0 && Math.random() <= this.loss) {
			return this;
		}

		if (this.latency > 0) {
			await wait(this.latency / 2);
		}

		const reader = new BufferReader(data);

		if (reader.byteLength === 0) {
			return this;
		}

		const code = reader.readUint8();
		const event = this.protocol.in.name(code);

		// The server is trusted, but a version skew between the two event lists is not.
		if (event === undefined) {
			error("Network", `Received an unknown event code ${code}`);

			return this;
		}

		try {
			const callback = this.messages[code];

			if (callback) {
				callback(this.protocol.decode(event, reader));
			}

			this.emit("message", event, reader);
		} catch (err) {
			error("Network", `Failed to handle "${event}":`, err instanceof Error ? err.message : err);
		}

		return this;
	}

	/**
	 * Registers a handler for an incoming event.
	 * @param event The event to listen for. Must be one of the names declared in `settings.in.events`.
	 * @param callback Receives the decoded data when the event has an inbound schema, the raw reader otherwise.
	 */
	public onMessage<K extends InboundEvent<C>>(event: K, callback: (data: MessagePayload<C, K>) => void): this {
		this.messages[this.protocol.in.code(event)] = callback;

		return this;
	}

	/**
	 * Feeds a message into the local handler as if it had arrived from the server.
	 *
	 * @param event The event to simulate. Must be one of the names declared in `settings.in.events`.
	 * @param data The payload, encoded with the *inbound* schema when the event has one.
	 */
	public simulate<K extends InboundEvent<C>>(event: K, data: MessagePayload<C, K>): void {
		this.handle(this.protocol.encode(event, data as Buffers | Record<string, any>, true));
	}

	private onConnect(): void {
		log("Network", "Connected to", this.socket?.url);

		this.emit("connection");

		if (this.reconnecting) {
			this.reconnecting = false;

			this.emit("reconnection");
		}
	}

	private onDisconnect(code: number, reason: string): void {
		this.reconnectTimeout?.clear();

		// 1006 is an abnormal close: no close frame, so the server never decided to drop us.
		if (code === 1006 && !this.manuallyDisconnected && this.baseURL) {
			const baseURL = this.baseURL;

			error("Network", "Connection lost, trying to reconnect");

			this.reconnectTimeout = new Timeout(() => {
				this.connectDetached(baseURL);
			}, 500);
		} else {
			this.sessionID = null;

			log("Network", "Disconnected from server with code", code, reason);
		}

		this.emit("disconnection", code, reason, this.manuallyDisconnected);

		this.manuallyDisconnected = false;
	}

	/**
	 * Returns the current state of the WebSocket connection.
	 *
	 * @see NetworkState
	 */
	public get readyState(): NetworkState {
		return this.socket?.readyState ?? NetworkState.CLOSED;
	}
}
