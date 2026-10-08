import { error, log, warn } from "../../../shared/utils/logger";

import { Interval, Timeout } from "../../../shared/utils/timers/timer";

import { wait } from "../../../shared/utils/timers/wait";

import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { MessageHandlers } from "../../../shared/networking/handlers";
import { PING_CODE, Protocol, SOCKET_ROUTE, type Contract, type ContractOf, type InboundEvent, type MessagePayload, type OutboundEvent, type SchemasFor, type SendPayload } from "../../../shared/networking/protocol";
import { BufferReader, type Buffers } from "@nasselk/binarypack";

type NetworkEvents = {
	connection: [];
	disconnection: [code: number, reason: string, manual: boolean];
	reconnection: [];
	message: [event: string, data: BufferReader];
	stats: [stats: NetworkStats];
};

export type NetworkChannelStats = {
	bps: number;
	mps: number;
};

export type NetworkStats = {
	readonly in: NetworkChannelStats;
	readonly out: NetworkChannelStats;
	latency: number;
};

type ChannelState = {
	bytes: number;
	messages: number;
};

type NetworkStatsState = {
	readonly in: ChannelState;
	readonly out: ChannelState;
	since: number;
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
	readonly simulation?: {
		readonly latency?: number;
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
	private static readonly PING = new Uint8Array([PING_CODE]);

	/** When the last ping left, to time its answer. */
	private pingSentAt = 0;

	public readonly protocol: Protocol<C>;
	private readonly handlers: MessageHandlers<(data: any) => void>;
	private socket?: WebSocket | null;

	/** Bumped by every `connect` and `disconnect`, so a connect still closing the last socket knows it was overtaken. */
	private attempt = 0;
	private baseURL?: string;
	private promise?: Promise<WebSocket>;
	private reconnectTimeout?: Timeout;
	private manuallyDisconnected: boolean;
	private reconnecting: boolean;
	private readonly simulation: {
		latency: number;
		loss: number;
	};

	private readonly statsTimer: Interval;
	private readonly state: NetworkStatsState;
	public readonly stats: NetworkStats;

	public constructor(options?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>) {
		super();

		this.protocol = new Protocol<C>(options);
		this.handlers = new MessageHandlers(this.protocol.in);
		this.manuallyDisconnected = false;
		this.reconnecting = false;
		this.simulation = {
			latency: options?.simulation?.latency ?? 0,
			loss: options?.simulation?.loss ?? 0,
		};

		this.stats = {
			in: { bps: 0, mps: 0 },
			out: { bps: 0, mps: 0 },
			latency: 0,
		};

		this.state = {
			in: { bytes: 0, messages: 0 },
			out: { bytes: 0, messages: 0 },
			since: 0,
		};

		this.statsTimer = new Interval(() => this.computeStats(), 1000, false);

		this.statsTimer.pause();
	}

	/**
	 * Connects to the server, closing any connection already open.
	 *
	 * @param url Base URL of the server, e.g. `http://localhost:3000`. `ws(s)://` is derived from it.
	 *
	 * @returns A promise that resolves to the WebSocket instance when the connection is established.
	 */
	public async connect(url: URL | string): Promise<WebSocket> {
		const attempt = ++this.attempt;

		await this.close();

		if (attempt !== this.attempt) {
			throw new Error("Connection superseded by a later connect or disconnect");
		}

		// A trailing slash would double up against the route, which starts with one.
		const baseURL = (this.baseURL = (url instanceof URL ? url.toString() : url).replace(/\/+$/, ""));

		// http -> ws, https -> wss. Anchored so a host containing "http" is left alone.
		return this.setupWebSocket(baseURL.replace(/^http/, "ws") + SOCKET_ROUTE);
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
		this.attempt++;
		this.reconnecting = false;

		return this.close(code, reason);
	}

	private async close(code?: number, reason?: string): Promise<this> {
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

	private setupWebSocket(url: string): Promise<WebSocket> {
		const socket = (this.socket = new WebSocket(url));
		socket.binaryType = "arraybuffer";

		let opened = false;

		this.promise = new Promise((resolve, reject) => {
			socket.addEventListener("open", () => {
				opened = true;

				resolve(socket);

				this.onConnect();
			});

			socket.addEventListener("message", async (message: MessageEvent) => {
				if (socket === this.socket) {
					await this.handle(message.data);
				}
			});

			socket.addEventListener("close", (event: CloseEvent) => {
				if (!opened) {
					reject(new Error(`WebSocket closed before opening (code ${event.code}${event.reason ? `: ${event.reason}` : ""})`));
				}

				if (socket === this.socket) {
					this.onDisconnect(event.code, event.reason);
				}
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

		await this.transmit(this.protocol.encode(event, data));

		return this;
	}

	/** Send one framed message, counted, through the simulated loss and latency. */
	private async transmit(buffer: Uint8Array<ArrayBuffer>): Promise<void> {
		this.state.out.bytes += buffer.byteLength;
		this.state.out.messages++;

		if (this.simulation.loss > 0 && Math.random() <= this.simulation.loss) {
			return;
		}

		if (this.simulation.latency > 0) {
			await wait(this.simulation.latency / 2);
		}

		// The socket can close while the simulated latency is being waited out.
		if (this.readyState === NetworkState.OPEN) {
			this.socket!.send(buffer);
		}
	}

	/** Time a round trip to the server: `stats.latency` is set when the answer arrives. */
	private ping(): void {
		if (this.readyState === NetworkState.OPEN) {
			this.pingSentAt = performance.now();

			void this.transmit(NetworkSystem.PING);
		}
	}

	private async handle(data: Buffers): Promise<this> {
		this.state.in.bytes += data.byteLength;
		this.state.in.messages++;

		if (this.simulation.loss > 0 && Math.random() <= this.simulation.loss) {
			return this;
		}

		if (this.simulation.latency > 0) {
			await wait(this.simulation.latency / 2);
		}

		const reader = new BufferReader(data);

		if (reader.byteLength === 0) {
			return this;
		}

		const code = reader.readUint8();

		if (code === PING_CODE) {
			this.stats.latency = performance.now() - this.pingSentAt;

			return this;
		}

		const event = this.protocol.in.name(code);

		// The server is trusted, but a version skew between the two event lists is not.
		if (event === undefined) {
			error("Network", `Received an unknown event code ${code}`);

			return this;
		}

		try {
			const callback = this.handlers.get(code);

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
	 * Registers the handler for an incoming event. One handler per event, since a raw reader can only
	 * be read once: registering a second throws. Listen on the `message` event to watch all traffic.
	 *
	 * @param event The event to listen for. Must be one of the names declared in `settings.in.events`.
	 * @param callback Receives the decoded data when the event has an inbound schema, the raw reader otherwise.
	 * @returns A function that removes the handler, so another can be registered.
	 */
	public onMessage<K extends InboundEvent<C>>(event: K, callback: (data: MessagePayload<C, K>) => void): () => void {
		return this.handlers.add(event, callback);
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
		log("Network", "Connected to", this.baseURL + SOCKET_ROUTE);

		this.resetStats();
		this.statsTimer.resume();
		this.ping();

		this.emit("connection");

		if (this.reconnecting) {
			this.reconnecting = false;

			this.emit("reconnection");
		}
	}

	private onDisconnect(code: number, reason: string): void {
		this.reconnectTimeout?.clear();
		this.statsTimer.pause();

		this.emit("disconnection", code, reason, this.manuallyDisconnected);

		// 1006 is an abnormal close: no close frame, so the server never decided to drop us.
		if (!this.manuallyDisconnected && this.baseURL) {
			const baseURL = this.baseURL;

			error("Network", "Connection lost, trying to reconnect", code, reason);

			this.reconnectTimeout = new Timeout(() => {
				this.reconnecting = true;
				this.connect(baseURL).catch((err) => {
					warn("Network", "Reconnection failed:", err instanceof Error ? err.message : err);
				});
			}, 500);
		} else {
			log("Network", "Disconnected from server with code", code, reason);
		}

		this.manuallyDisconnected = false;
	}

	private computeStats(): void {
		const state = this.state;
		const stats = this.stats;
		const now = performance.now();
		const elapsed = now - state.since;
		const perSecond = elapsed > 0 ? 1000 / elapsed : 0;

		stats.in.bps = state.in.bytes * perSecond;
		stats.in.mps = state.in.messages * perSecond;

		stats.out.bps = state.out.bytes * perSecond;
		stats.out.mps = state.out.messages * perSecond;

		this.resetStats(now);

		this.emit("stats", stats);

		this.ping();
	}

	private resetStats(now: number = performance.now()): void {
		const state = this.state;

		state.in.bytes = 0;
		state.in.messages = 0;
		state.out.bytes = 0;
		state.out.messages = 0;
		state.since = now;
	}

	public destroy(): void {
		this.statsTimer.clear();
		this.disconnect();
		this.reconnectTimeout?.clear();

		this.removeAllListeners();
	}

	/**
	 * Returns the current state of the WebSocket connection.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
	 */
	public get readyState(): NetworkState {
		return this.socket?.readyState ?? NetworkState.CLOSED;
	}

	/**
	 * Returns the number of bytes currently buffered in the WebSocket connection.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/bufferedAmount
	 */
	public get buffered(): number {
		return this.socket?.bufferedAmount ?? 0;
	}

	/**
	 * Returns the simulated latency in milliseconds. The latency is applied as half on send and half on receive.
	 */
	public get latency(): number {
		return this.simulation.latency;
	}

	/**
	 * Sets the simulated latency in milliseconds. The latency is applied as half on send and half on receive.
	 */
	public set latency(latency: number) {
		if (latency < 0) {
			throw new Error("Latency must be a non-negative number");
		}

		this.simulation.latency = latency;
	}

	/**
	 * Returns the simulated packet loss as a number in `[0, 1]`. Each message has that chance of being silently dropped.
	 */
	public get loss(): number {
		return this.simulation.loss;
	}

	/**
	 * Sets the simulated packet loss as a number in `[0, 1]`. Each message has that chance of being silently dropped.
	 */
	public set loss(loss: number) {
		if (loss < 0 || loss > 1) {
			throw new Error("Loss must be a number in [0, 1]");
		}

		this.simulation.loss = loss;
	}
}
