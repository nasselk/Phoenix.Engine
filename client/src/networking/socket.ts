import { isBufferView, type Buffers } from "@libs/buffer/buffer";

import { clientSchemas } from "@libs/schema/schemas/client";

import { clientEvents } from "@shared/networking/events/client";

import { type SchemaToData } from "@libs/schema/types";

import { BufferWriter } from "@libs/buffer/writer";

import { error, log } from "@utils/logger";

import { hideMessage, showMessage } from "../UI/lib/interaction";

import { Timeout } from "@utils/timers/timer";

import { type Server } from "./findServer";

import { wait } from "@utils/timers/wait";

import { attachAuthToGameSessionIfAuthed, resetGameServerAuthAttachment } from "./gameServerAuth";

import { leaderboard } from "../UI/stores/HUD/leaderboard.svelte";

import { Entity } from "../entities/entity";

import Game from "../game";
import { app, banState } from "../UI/stores/app.svelte";
import { EventEmitter } from "@utils/EventEmitter";

type SocketEvents = {
	open: [event: Event];
	close: [code: number, reason: string];
	message: [data: BufferReader];
	error: [error: Error];
};

export class Socket extends EventEmitter<SocketEvents> {
	private socket?: WebSocket | null;
	private promise?: Promise<WebSocket>;
	public readyState: "connecting" | "open" | "closed";
	private reconnectTimeout?: Timeout;
	public server?: Server;
	private readonly settings: {
		latency: number;
		loss: number;
	};

	public constructor(latency: number = 0, loss: number = 0, server?: Server) {
		super();

		this.readyState = "closed";
		this.settings = {
			latency,
			loss,
		};

		if (server) {
			this.connect(server);
		}
	}

	private static buildMessage<E extends keyof typeof clientEvents>(event: E | number, data?: Buffers | Record<string, any>): Uint8Array {
		const encoder = typeof event === "number" ? event : clientEvents[event].encoder;

		if (!data) {
			const writer = new BufferWriter(1);

			writer.writeUint8(encoder);

			return writer.bytes;
		} else if (isBufferView(data)) {
			const writer = new BufferWriter(data);

			writer.writeUint8(encoder, 0);

			writer.fillOffset();

			return writer.bytes;
		} else if (event in clientSchemas) {
			return clientSchemas[event as keyof typeof clientSchemas].encode(data as any);
		} else {
			throw new Error(`No encoder for ${event} and no buffer was provided`);
		}
	}

	public async connect(url: string): Promise<WebSocket> {
		this.socket?.close();

		const url = this.server.url.replace("http", "ws");

		this.socket = new WebSocket(url);
		this.socket.binaryType = "arraybuffer";
		this.readyState = "connecting";

		this.promise = new Promise((resolve, reject) => {
			const socket = this.socket as WebSocket;

			socket.addEventListener("open", (event: Event) => {
				this.readyState = "open";

				this.emit("open", event);

				resolve();
			});

			socket.addEventListener("message", async (message: MessageEvent) => {
				this.handle(message.data);
			});

			socket.addEventListener("error", (error: Event) => {
				reject(error);
			});

			socket.addEventListener("close", (event: CloseEvent) => {
				this.onDisconnect(event.code, event.reason);

				if (event.code === 1006) {
					this.reconnectTimeout = new Timeout(() => {
						this.reconnect();
					}, 500);
				} else {
					log("Client", "Disconnected from server with code", event.code, event.reason);

					// Surface a server-provided disconnect reason to the player — e.g.
					// the single-session kick ("Signed in from another session"). The
					// client's own clean closes carry no reason, so this only fires for
					// server-initiated kicks (uWS `end(code, reason)`).
					if (event.reason) {
						showMessage(event.reason, "error", 8000);
					}

					this.shouldRetrieveSession = false;
				}
			});
		});

		return this.promise;
	}

	public async reconnect(): Promise<void> {
		error("Client", "Connection lost, trying to reconnect");

		showMessage("Connection lost, reconnecting", "error");

		return this.connect(this.server!);
	}

	public async send<E extends keyof typeof clientEvents>(event: E | number, data: E extends keyof typeof clientSchemas ? SchemaToData<(typeof clientSchemas)[E]> : never, reliable?: boolean): Promise<this>;
	public async send<E extends keyof typeof clientEvents>(event: E | number, data?: Buffers, reliable?: boolean): Promise<this>;
	public async send<E extends keyof typeof clientEvents>(event: E | number, data?: Buffers | (E extends keyof typeof clientSchemas ? SchemaToData<(typeof clientSchemas)[E]> : never), reliable: boolean = true): Promise<this> {
		if (this.readyState === "open") {
			const buffer = Socket.buildMessage(event, data);

			Game.stats.pannels.output?.update(buffer.byteLength, 1000);

			if (this.loss > 0 && Math.random() <= this.loss) {
				return this;
			}

			if (this.latency > 0) {
				await wait(this.latency / 2);
			}

			this.socket.send(buffer);
		}

		return this;
	}

	public async handle(data: ArrayBuffer): this {
		if (this.settings.loss > 0 && Math.random() <= this.settings.loss) {
			return this;
		}

		if (this.settings.latency > 0) {
			await wait(this.latency / 2);
		}

		this.emit("message", new BufferReader(data));
	}

	public async onConnect(): Promise<this> {
		log("Network Client", "Connected to", this.server?.url);

		// Destroy all entities
		for (const entity of Entity) {
			entity.destroy();
		}

		hideMessage();

		// Try to retrieve session if cookie is present
		if (this.shouldRetrieveSession) {
			this.send("retrieveSession");
		}

		this.shouldRetrieveSession = true;

		Game.camera.position.set(Infinity); // Reset camera position
		Game.loop.resize(); // Send FOV again

		leaderboard.serverName = this.server?.name ?? "";

		// Every new WS connection = a brand-new server-side Socket with no auth bound.
		// Reset our local attach-state so the next /auth/login fires.
		resetGameServerAuthAttachment();

		// If a user is currently signed in via accounts, re-attach the auth state to this
		// new WS session on the game server. No-op for anonymous players.
		attachAuthToGameSessionIfAuthed();

		app.currentScreen = "menu";

		return this;
	}

	public onDisconnect(code: number, reason: string): void {
		this.reset();

		Game.playerID = null;
		Game.player = null;

		// A banned client must not hammer the server with reconnect attempts — the
		// banned screen is already shown (set by the `banNotice` handler).
		if (banState.banned) {
			log("Client", "Disconnected while banned — suppressing reconnect");
			return;
		}
	}

	public close(code: number = 1000, reason: string = ""): this {
		this.readyState = "closed";
		this.socket.close(code, reason);

		return this;
	}

	private reset(): this {
		this.readyState = "closed";
		this.reconnectTimeout?.clear();

		return this;
	}
}
