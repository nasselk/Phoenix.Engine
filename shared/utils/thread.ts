import { error } from "./logger";

type transferable = ArrayBuffer | MessagePort;

/** What two threads say to each other: each event's `data`, and for one that is requested, the `response` that comes back. */
export type ThreadMessages = { readonly [event: string]: { readonly data: unknown; readonly response?: unknown } };

export type ThreadRequestOptions = {
	/** Buffers and ports handed over instead of copied. */
	readonly transfer?: transferable[];
	/** Milliseconds before the request rejects. None by default. */
	readonly timeout?: number;
};

type Event<M> = keyof M & string;

type DataOf<M extends ThreadMessages, E extends keyof M> = M[E]["data"];

type ResponseOf<M extends ThreadMessages, E extends keyof M> = M[E]["response"];

type Listener<M extends ThreadMessages, E extends keyof M> = (data: DataOf<M, E>) => void;

type Handler<M extends ThreadMessages, E extends keyof M> = (data: DataOf<M, E>, transfer: transferable[]) => ResponseOf<M, E> | Promise<ResponseOf<M, E>>;

type Pending = {
	readonly resolve: (response: any) => void;
	readonly reject: (reason: Error) => void;
	readonly timer?: ReturnType<typeof setTimeout>;
};

interface Endpoint {
	postMessage(message: unknown, transfer: transferable[]): void;
	addEventListener(type: string, listener: (event: any) => void): void;
}

const SEND = 0;
const REQUEST = 1;
const RESPONSE = 2;
const FAILURE = 3;

/**
 * Messages and awaited requests between two threads, the same in Bun and in browsers: a worker it
 * wraps, the worker's own side with `Thread.parent()`, or either end of a `Thread.getChannel()`.
 * Both ends declare the same `ThreadMessages`.
 */
export class Thread<M extends ThreadMessages> {
	private readonly endpoint: Endpoint;
	private readonly listeners: Map<string, Set<Listener<M, any>>>;
	private readonly handlers: Map<string, Handler<M, any>>;
	private readonly pending: Map<number, Pending>;
	private nextRequestID: number;
	private terminated: boolean;

	public constructor(endpoint: Worker | MessagePort) {
		this.endpoint = endpoint as Endpoint;
		this.listeners = new Map();
		this.handlers = new Map();
		this.pending = new Map();
		this.nextRequestID = 1;
		this.terminated = false;

		this.endpoint.addEventListener("message", ({ data }: MessageEvent) => this.receive(data));

		if (endpoint instanceof MessagePort) {
			endpoint.start();
		} else {
			this.endpoint.addEventListener("error", (event: ErrorEvent) => error("Thread", `Worker error: ${event.message}`));
			this.endpoint.addEventListener("close", () => this.rejectPending("The worker stopped"));
		}
	}

	/** The thread that started this worker. Throws outside a worker. */
	public static parent<M extends ThreadMessages>(): Thread<M> {
		const isMainThread = (globalThis as { Bun?: { isMainThread: boolean } }).Bun?.isMainThread ?? "window" in globalThis;

		if (isMainThread) {
			throw new Error("Thread.parent() is only available inside a worker");
		}

		return new Thread<M>(globalThis as unknown as MessagePort);
	}

	/** Two connected ports: keep one, transfer the other to a worker, and wrap each in a Thread. */
	public static getChannel(): [MessagePort, MessagePort] {
		const channel = new MessageChannel();

		return [channel.port1, channel.port2];
	}

	public send<E extends Event<M>>(event: E, data: DataOf<M, E>, transfer: transferable[] = []): void {
		this.post([SEND, event, data, 0], transfer);
	}

	/** Every `send` of that event. Returns a function that stops listening. */
	public on<E extends Event<M>>(event: E, listener: Listener<M, E>): () => void {
		let listeners = this.listeners.get(event);

		if (listeners === undefined) {
			listeners = new Set();

			this.listeners.set(event, listeners);
		}

		listeners.add(listener);

		return () => listeners.delete(listener);
	}

	/** Resolves with what the other side's handler returns; rejects when it throws, has no handler, times out, or the thread ends. */
	public request<E extends Event<M>>(event: E, data: DataOf<M, E>, { transfer = [], timeout = 0 }: ThreadRequestOptions = {}): Promise<ResponseOf<M, E>> {
		if (this.terminated) {
			return Promise.reject(new Error("The thread is terminated"));
		}

		const requestID = this.nextRequestID++;

		return new Promise((resolve, reject) => {
			const timer = timeout > 0 ? setTimeout(() => this.settle(requestID, FAILURE, `Request "${event}" timed out after ${timeout} ms`), timeout) : undefined;

			this.pending.set(requestID, { resolve, reject, timer });

			this.post([REQUEST, event, data, requestID], transfer);
		});
	}

	/**
	 * Answers every `request` of that event with what the handler returns, or awaits. Buffers pushed
	 * to `transfer` are handed over with the response. One handler per event.
	 */
	public onRequest<E extends Event<M>>(event: E, handler: Handler<M, E>): () => void {
		if (this.handlers.has(event)) {
			throw new Error(`Requests for "${event}" already have a handler`);
		}

		this.handlers.set(event, handler);

		return () => {
			if (this.handlers.get(event) === handler) {
				this.handlers.delete(event);
			}
		};
	}

	/** Stops the worker or closes the port, and rejects every request still waiting. */
	public terminate(): void {
		if (this.terminated) {
			return;
		}

		this.terminated = true;

		this.rejectPending("The thread is terminated");

		this.listeners.clear();
		this.handlers.clear();

		if (this.endpoint instanceof MessagePort) {
			this.endpoint.close();
		} else if (typeof Worker !== "undefined" && this.endpoint instanceof Worker) {
			this.endpoint.terminate();
		}
	}

	private receive(message: [number, string, unknown, number]): void {
		const [kind, event, data, requestID] = message;

		if (kind === SEND) {
			const listeners = this.listeners.get(event);

			if (listeners !== undefined) {
				for (const listener of listeners) {
					try {
						listener(data);
					} catch (cause) {
						error("Thread", `A listener for "${event}" threw:`, cause);
					}
				}
			}
		} else if (kind === REQUEST) {
			this.answer(event, data, requestID);
		} else {
			this.settle(requestID, kind, data);
		}
	}

	private async answer(event: string, data: unknown, requestID: number): Promise<void> {
		const handler = this.handlers.get(event);
		const transfer: transferable[] = [];

		try {
			if (handler === undefined) {
				throw new Error(`No handler for requests of "${event}"`);
			}

			const response = await handler(data, transfer);

			this.post([RESPONSE, event, response, requestID], transfer);
		} catch (cause) {
			this.post([FAILURE, event, cause instanceof Error ? cause.message : String(cause), requestID], []);
		}
	}

	private settle(requestID: number, kind: number, data: unknown): void {
		const pending = this.pending.get(requestID);

		if (pending === undefined) {
			return;
		}

		this.pending.delete(requestID);

		clearTimeout(pending.timer);

		if (kind === RESPONSE) {
			pending.resolve(data);
		} else {
			pending.reject(new Error(String(data)));
		}
	}

	private rejectPending(reason: string): void {
		for (const requestID of [...this.pending.keys()]) {
			this.settle(requestID, FAILURE, reason);
		}
	}

	private post(message: [number, string, unknown, number], transfer: transferable[]): void {
		if (!this.terminated) {
			this.endpoint.postMessage(message, transfer);
		}
	}
}
