import { error } from "./logger";
const SEND = 0;
const REQUEST = 1;
const RESPONSE = 2;
const FAILURE = 3;
export class Thread {
    constructor(endpoint) {
        this.endpoint = endpoint;
        this.listeners = new Map();
        this.handlers = new Map();
        this.pending = new Map();
        this.nextRequestID = 1;
        this.terminated = false;
        this.endpoint.addEventListener("message", ({ data }) => this.receive(data));
        if (endpoint instanceof MessagePort) {
            endpoint.start();
        }
        else {
            this.endpoint.addEventListener("error", (event) => error("Thread", `Worker error: ${event.message}`));
            this.endpoint.addEventListener("close", () => this.rejectPending("The worker stopped"));
        }
    }
    static parent() {
        const isMainThread = globalThis.Bun?.isMainThread ?? "window" in globalThis;
        if (isMainThread) {
            throw new Error("Thread.parent() is only available inside a worker");
        }
        return new Thread(globalThis);
    }
    static getChannel() {
        const channel = new MessageChannel();
        return [channel.port1, channel.port2];
    }
    send(event, data, transfer = []) {
        this.post([SEND, event, data, 0], transfer);
    }
    on(event, listener) {
        let listeners = this.listeners.get(event);
        if (listeners === undefined) {
            listeners = new Set();
            this.listeners.set(event, listeners);
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
    request(event, data, { transfer = [], timeout = 0 } = {}) {
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
    onRequest(event, handler) {
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
    terminate() {
        if (this.terminated) {
            return;
        }
        this.terminated = true;
        this.rejectPending("The thread is terminated");
        this.listeners.clear();
        this.handlers.clear();
        if (this.endpoint instanceof MessagePort) {
            this.endpoint.close();
        }
        else if (typeof Worker !== "undefined" && this.endpoint instanceof Worker) {
            this.endpoint.terminate();
        }
    }
    receive(message) {
        const [kind, event, data, requestID] = message;
        if (kind === SEND) {
            const listeners = this.listeners.get(event);
            if (listeners !== undefined) {
                for (const listener of listeners) {
                    try {
                        listener(data);
                    }
                    catch (cause) {
                        error("Thread", `A listener for "${event}" threw:`, cause);
                    }
                }
            }
        }
        else if (kind === REQUEST) {
            this.answer(event, data, requestID);
        }
        else {
            this.settle(requestID, kind, data);
        }
    }
    async answer(event, data, requestID) {
        const handler = this.handlers.get(event);
        const transfer = [];
        try {
            if (handler === undefined) {
                throw new Error(`No handler for requests of "${event}"`);
            }
            const response = await handler(data, transfer);
            this.post([RESPONSE, event, response, requestID], transfer);
        }
        catch (cause) {
            this.post([FAILURE, event, cause instanceof Error ? cause.message : String(cause), requestID], []);
        }
    }
    settle(requestID, kind, data) {
        const pending = this.pending.get(requestID);
        if (pending === undefined) {
            return;
        }
        this.pending.delete(requestID);
        clearTimeout(pending.timer);
        if (kind === RESPONSE) {
            pending.resolve(data);
        }
        else {
            pending.reject(new Error(String(data)));
        }
    }
    rejectPending(reason) {
        for (const requestID of [...this.pending.keys()]) {
            this.settle(requestID, FAILURE, reason);
        }
    }
    post(message, transfer) {
        if (!this.terminated) {
            this.endpoint.postMessage(message, transfer);
        }
    }
}
//# sourceMappingURL=thread.js.map