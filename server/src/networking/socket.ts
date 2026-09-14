import type { ServerWebSocket } from "bun";
import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { warn } from "../../../shared/utils/logger";
import { type Contract, type InboundEvent, type MessagePayload, type OutboundEvent, type Protocol, type SendPayload } from "../../../shared/networking/protocol";

type SocketEvents<C extends Contract> = {
	disconnection: [code: number, reason: string, manual: boolean];
	message: [event: InboundEvent<C>, data: MessagePayload<C, InboundEvent<C>>];
};

/** What Bun carries on the raw websocket. Set during the upgrade, before `open` runs. */
export type SocketUserData = {
	/** Assigned in `open`, so it is absent for exactly as long as the handshake takes. */
	socket?: Socket<any>;
	readonly ip: string;
	readonly sessionID: string;
	/** The session id this connection reclaimed, when the client presented a live one. */
	readonly reconnectionToken?: string;
};

export const enum SocketState {
	CONNECTING,
	OPEN,
	CLOSING,
	CLOSED,
}

export class Socket<C extends Contract = Contract> extends EventEmitter<SocketEvents<C>> {
	public readonly id: number;
	public readonly ip: string;
	public readonly sessionID: string;
	public readonly reconnectionToken?: string;
	/** `performance.now()` of the last frame received. The idle sweep reads this. */
	public lastMessage: number;
	/** Frames received since the last `resetRates()`, in total... */
	public messages: number;
	public readonly rates: CounterMap<number>;
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
	 * Subscribes to a topic on the socket's pub/sub channel. The server can publish to it with
	 *
	 * @param topic The topic to subscribe to. The server can publish to it with `socket.publish(topic, buffer)`.
	 *
	 * @returns this socket, for chaining.
	 */
	public subscribe(topic: string): this {
		this.socket.subscribe(topic);

		return this;
	}

	/**
	 * Unsubscribes from a topic on the socket's pub/sub channel. The server can publish to it with
	 *
	 * @param topic  The topic to unsubscribe from. The server can publish to it with `socket.publish(topic, buffer)`.
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
	 * Disconnects the socket. If the socket is already closed, this does nothing.
	 *
	 * @param forcefully If true, the socket is terminated abruptly without sending a close frame
	 */
	public disconnect(forcefully?: true): void;

	/**
	 * Disconnects the socket. If the socket is already closed, this does nothing.
	 *
	 * @param forcefully If false, a close frame is sent with the provided reason and code.
	 * @param reason The reason for disconnection.
	 * @param code The close code for disconnection.
	 */
	public disconnect(forcefully?: false, reason?: string, code?: number): void;

	public disconnect(forcefully?: boolean, reason: string = "", code: number = 1000): void {
		if (code !== 1000) {
			warn("Game Server", `Disconnecting ${this.ip} with code ${code} - ${reason}`);
		}

		this.manuallyDisconnected = true;

		if (this.readyState === SocketState.CONNECTING || this.readyState === SocketState.OPEN) {
			if (forcefully) {
				// Abrupt close, no close frame.
				this.socket.terminate();
			} else {
				// Graceful close with a status code + reason.
				this.socket.close(code, reason);
			}
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
