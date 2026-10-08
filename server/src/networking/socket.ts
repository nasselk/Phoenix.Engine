import type { ServerWebSocket } from "bun";
import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { warn } from "../../../shared/utils/logger";
import { PING_CODE, type Contract, type InboundEvent, type MessagePayload, type OutboundEvent, type Protocol, type SendPayload } from "../../../shared/networking/protocol";
import { Seen } from "../world/replication";
import type { World } from "../world/world";

type SocketEvents<C extends Contract> = {
	disconnection: [code: number, reason: string, manual: boolean];
	message: [event: InboundEvent<C>, data: MessagePayload<C, InboundEvent<C>>];
};

/**
 * Whatever a game keeps on a connection, like the player it drives. Empty here: a game adds its own
 * fields, all optional, since a new connection has none of them yet.
 *
 *   declare module "phoenix.engine/server" {
 *   	interface SocketData { player?: Player }
 *   }
 */
// biome-ignore lint/suspicious/noEmptyInterface: a game merges its own fields into it.
export interface SocketData {}

/** What Bun carries on the raw websocket. Set during the upgrade, before `open` runs. */
export type SocketUserData = {
	socket?: Socket<any>;
	readonly ip: string;
	readonly sessionID: string;
	readonly reconnectionToken?: string;
};

export enum SocketState {
	CONNECTING,
	OPEN,
	CLOSING,
	CLOSED,
}

export class Socket<C extends Contract = Contract> extends EventEmitter<SocketEvents<C>> {
	private static readonly PING = new Uint8Array([PING_CODE]);

	public readonly id: number;
	public readonly ip: string;
	public readonly sessionID: string;
	public readonly reconnectionToken?: string;
	public lastMessage: number;
	/** Frames received since the last `resetRates()`, in total... */
	public messages: number;
	public readonly rates: CounterMap<number>;
	public readonly room?: World<any, any, C>;
	/** Which entities this socket's client holds. The room's frames keep it; it empties when the socket leaves the room. */
	public readonly seen: Seen;
	/** The game's own record for this connection. See SocketData. */
	public readonly data: SocketData;
	private readonly protocol: Protocol<C>;
	private readonly socket: ServerWebSocket<SocketUserData>;
	private manuallyDisconnected: boolean;

	public constructor(protocol: Protocol<C>, socket: ServerWebSocket<SocketUserData>, id: number) {
		super();

		this.id = id;
		this.socket = socket;
		this.protocol = protocol;
		this.ip = socket.data.ip ?? socket.remoteAddress;
		this.sessionID = socket.data.sessionID;
		this.reconnectionToken = socket.data.reconnectionToken;
		this.lastMessage = performance.now();
		this.messages = 0;
		this.rates = new CounterMap();
		this.manuallyDisconnected = false;
		this.seen = new Seen();
		this.data = {};
	}

	/**
	 * Sends an event to this client.
	 *
	 * @param event The event to send. Must be one of the names declared in the server's `out.events`.
	 * @param data The payload. Encoded data when the event has an outbound schema, an optional buffer otherwise.
	 */
	public send<K extends OutboundEvent<C>>(event: K, ...[data]: SendPayload<C, K>): this {
		if (this.readyState === SocketState.OPEN) {
			const buffer = this.protocol.encode(event, data);

			this.socket.send(buffer);
		}

		return this;
	}

	/** Answer the client's ping, with the same single byte. */
	public answerPing(): void {
		if (this.readyState === SocketState.OPEN) {
			this.socket.send(Socket.PING);
		}
	}

	/**
	 * Sends an event to every *other* connected client. Encoded once, then handed to each socket.
	 *
	 * @see NetworkSystem.broadcast to include this socket.
	 */
	public broadcast<K extends OutboundEvent<C>>(topic: string, event: K, ...[data]: SendPayload<C, K>): this {
		this.socket.publish(topic, this.protocol.encode(event, data));

		return this;
	}

	/**
	 * Corks the socket, runs the callback, then flushes the corked messages. This is a Bun optimization
	 * that reduces the number of TCP packets sent when many messages are sent in a row.
	 *
	 * @param callback The callback to run while the socket is corked. It receives this socket as an argument.
	 *
	 * @returns This socket, for chaining.
	 */
	public cork(callback: (socket: this) => void): this {
		this.socket.cork(() => callback(this));

		return this;
	}

	/**
	 * Subscribes to a topic, so this socket receives what `network.broadcast(topic, …)` sends to it,
	 * and what any other socket's `broadcast(topic, …)` does.
	 *
	 * @returns this socket, for chaining.
	 */
	public subscribe(topic: string): this {
		this.socket.subscribe(topic);

		return this;
	}

	/**
	 * Unsubscribes from a topic: broadcasts to it stop reaching this socket.
	 *
	 * @returns this socket, for chaining.
	 */
	public unsubscribe(topic: string): this {
		this.socket.unsubscribe(topic);

		return this;
	}

	/** Called once per second by the idle sweep: the rate limits are per second. */
	public resetRates(): void {
		this.messages = 0;
		this.rates.clear();
	}

	/**
	 * Closes the socket with a close frame carrying the reason and code. Does nothing once closed.
	 *
	 * @param code A WebSocket close code: 1000 is a normal close, anything else is logged.
	 */
	public disconnect(reason: string = "", code: number = 1000): void {
		if (code !== 1000) {
			warn("Game Server", `Disconnecting ${this.ip} with code ${code} - ${reason}`);
		}

		this.manuallyDisconnected = true;

		if (this.readyState === SocketState.CONNECTING || this.readyState === SocketState.OPEN) {
			this.socket.close(code, reason);
		}
	}

	/** Cuts the connection at once, without a close frame. Does nothing once closed. */
	public terminate(): void {
		this.manuallyDisconnected = true;

		if (this.readyState === SocketState.CONNECTING || this.readyState === SocketState.OPEN) {
			this.socket.terminate();
		}
	}

	public disconnection(code: number, reason: string): void {
		this.emit("disconnection", code, reason, this.manuallyDisconnected);

		this.removeAllListeners();
	}

	/**
	 * Returns the current state of the WebSocket connection.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
	 */
	public get readyState(): SocketState {
		return this.socket?.readyState ?? SocketState.CLOSED;
	}
}
