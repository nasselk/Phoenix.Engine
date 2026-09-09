import { error, log } from "../../../shared/utils/logger";
import { Timeout } from "../../../shared/utils/timers/timer";
import { wait } from "../../../shared/utils/timers/wait";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { post } from "../../../shared/utils/fetch";
import { Protocol } from "../../../shared/networking/protocol";
import { SESSION_ROUTE, SESSION_SUBPROTOCOL, WS_ROUTE } from "../../../shared/networking/session";
import { BufferReader } from "@nasselk/binarypack";
export var NetworkState;
(function (NetworkState) {
    NetworkState[NetworkState["CONNECTING"] = 0] = "CONNECTING";
    NetworkState[NetworkState["OPEN"] = 1] = "OPEN";
    NetworkState[NetworkState["CLOSING"] = 2] = "CLOSING";
    NetworkState[NetworkState["CLOSED"] = 3] = "CLOSED";
})(NetworkState || (NetworkState = {}));
export class NetworkSystem extends EventEmitter {
    constructor(options) {
        super();
        this.protocol = new Protocol(options);
        this.messages = [];
        this.manuallyDisconnected = false;
        this.reconnecting = false;
        this.latency = options?.simulation?.latency ?? 0;
        this.loss = options?.simulation?.loss ?? 0;
        if (options?.url) {
            this.connectDetached(options.url);
        }
    }
    connectDetached(url) {
        this.connect(url).catch((err) => {
            error("Network", "Connection failed:", err instanceof Error ? err.message : err);
        });
    }
    async connect(url, data) {
        await this.disconnect();
        const baseURL = (this.baseURL = (url instanceof URL ? url.toString() : url).replace(/\/+$/, ""));
        const response = await post(baseURL, SESSION_ROUTE, {
            reconnectionToken: this.sessionID ?? null,
            ...data,
        });
        if (!response.success) {
            throw new Error(`Failed to initialize session: ${response.error?.message ?? "unknown error"}`);
        }
        const session = response.data;
        this.sessionID = session.sessionID;
        this.reconnecting = session.allowReconnection;
        return this.setupWebSocket(baseURL.replace(/^http/, "ws") + WS_ROUTE, session.ticket);
    }
    async disconnect(code, reason) {
        this.reconnectTimeout?.clear();
        this.reconnectTimeout = undefined;
        return new Promise((resolve) => {
            if (this.readyState === NetworkState.CONNECTING || this.readyState === NetworkState.OPEN) {
                this.socket?.addEventListener("close", () => {
                    resolve(this);
                }, { once: true });
                this.manuallyDisconnected = true;
                this.socket?.close(code, reason);
            }
            else {
                resolve(this);
            }
        });
    }
    setupWebSocket(url, ticket) {
        const socket = (this.socket = new WebSocket(url, [SESSION_SUBPROTOCOL, ticket]));
        socket.binaryType = "arraybuffer";
        let opened = false;
        this.promise = new Promise((resolve, reject) => {
            socket.addEventListener("open", () => {
                opened = true;
                resolve(socket);
                this.onConnect();
            });
            socket.addEventListener("message", async (message) => {
                await this.handle(message.data);
            });
            socket.addEventListener("close", (event) => {
                if (!opened) {
                    reject(new Error(`WebSocket closed before opening (code ${event.code}${event.reason ? `: ${event.reason}` : ""})`));
                }
                this.onDisconnect(event.code, event.reason);
            });
        });
        return this.promise;
    }
    async send(event, ...[data]) {
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
        if (this.readyState === NetworkState.OPEN) {
            this.socket.send(buffer);
        }
        return this;
    }
    async handle(data) {
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
        }
        catch (err) {
            error("Network", `Failed to handle "${event}":`, err instanceof Error ? err.message : err);
        }
        return this;
    }
    onMessage(event, callback) {
        this.messages[this.protocol.in.code(event)] = callback;
        return this;
    }
    simulate(event, data) {
        this.handle(this.protocol.encode(event, data, true));
    }
    onConnect() {
        log("Network", "Connected to", this.socket?.url);
        this.emit("connection");
        if (this.reconnecting) {
            this.reconnecting = false;
            this.emit("reconnection");
        }
    }
    onDisconnect(code, reason) {
        this.reconnectTimeout?.clear();
        if (code === 1006 && !this.manuallyDisconnected && this.baseURL) {
            const baseURL = this.baseURL;
            error("Network", "Connection lost, trying to reconnect");
            this.reconnectTimeout = new Timeout(() => {
                this.connectDetached(baseURL);
            }, 500);
        }
        else {
            this.sessionID = null;
            log("Network", "Disconnected from server with code", code, reason);
        }
        this.emit("disconnection", code, reason, this.manuallyDisconnected);
        this.manuallyDisconnected = false;
    }
    get readyState() {
        return this.socket?.readyState ?? NetworkState.CLOSED;
    }
}
