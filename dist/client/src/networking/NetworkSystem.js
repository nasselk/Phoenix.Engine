import { error, log, warn } from "../../../shared/utils/logger";
import { Interval, Timeout } from "../../../shared/utils/timers/timer";
import { wait } from "../../../shared/utils/timers/wait";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { post } from "../../../shared/utils/fetch";
import { Protocol } from "../../../shared/networking/protocol";
import { SESSION_SUBPROTOCOL } from "../../../shared/networking/session";
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
        this.simulation = {
            latency: options?.simulation?.latency ?? 0,
            loss: options?.simulation?.loss ?? 0,
        };
        this.stats = {
            in: { bps: 0, mps: 0 },
            out: { bps: 0, mps: 0 },
            latency: 10,
        };
        this.state = {
            in: { bytes: 0, messages: 0 },
            out: { bytes: 0, messages: 0 },
            latency: 0,
            since: 0,
        };
        this.statsTimer = new Interval(() => this.computeStats(), 1000, false);
        this.statsTimer.pause();
    }
    async connect(url, data) {
        await this.disconnect();
        const baseURL = (this.baseURL = (url instanceof URL ? url.toString() : url).replace(/\/+$/, ""));
        const response = await post(baseURL, "/session/init", {
            reconnectionToken: this.sessionID ?? null,
            ...data,
        }, {
            timeout: 5000,
            tries: 5,
        });
        if (!response.success) {
            throw new Error(`Failed to initialize session: ${response.error?.message ?? "unknown error"}`);
        }
        const session = response.data;
        this.sessionID = session.sessionID;
        this.reconnecting = session.allowReconnection;
        return this.setupWebSocket(baseURL.replace(/^http/, "ws") + "/ws", session.ticket);
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
        this.state.out.bytes += buffer.byteLength;
        this.state.out.messages++;
        if (this.simulation.loss > 0 && Math.random() <= this.simulation.loss) {
            return this;
        }
        if (this.simulation.latency > 0) {
            await wait(this.simulation.latency / 2);
        }
        if (this.readyState === NetworkState.OPEN) {
            this.socket.send(buffer);
        }
        return this;
    }
    async handle(data) {
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
        log("Network", "Connected to", this.baseURL + "/ws");
        this.resetStats();
        this.statsTimer.resume();
        this.emit("connection");
        if (this.reconnecting) {
            this.reconnecting = false;
            this.emit("reconnection");
        }
    }
    onDisconnect(code, reason) {
        this.reconnectTimeout?.clear();
        this.statsTimer.pause();
        this.emit("disconnection", code, reason, this.manuallyDisconnected);
        if (!this.manuallyDisconnected && this.baseURL) {
            const baseURL = this.baseURL;
            error("Network", "Connection lost, trying to reconnect", code, reason);
            this.reconnectTimeout = new Timeout(() => {
                this.connect(baseURL).catch((err) => {
                    warn("Network", "Reconnection failed:", err instanceof Error ? err.message : err);
                });
            }, 500);
        }
        else {
            this.sessionID = null;
            log("Network", "Disconnected from server with code", code, reason);
        }
        this.manuallyDisconnected = false;
    }
    computeStats() {
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
    }
    resetStats(now = performance.now()) {
        const state = this.state;
        state.in.bytes = 0;
        state.in.messages = 0;
        state.out.bytes = 0;
        state.out.messages = 0;
        state.since = now;
    }
    destroy() {
        this.statsTimer.clear();
        this.disconnect();
        this.reconnectTimeout?.clear();
        this.removeAllListeners();
    }
    get readyState() {
        return this.socket?.readyState ?? NetworkState.CLOSED;
    }
    get buffered() {
        return this.socket?.bufferedAmount ?? 0;
    }
    get latency() {
        return this.simulation.latency;
    }
    set latency(latency) {
        if (latency < 0) {
            throw new Error("Latency must be a non-negative number");
        }
        this.simulation.latency = latency;
    }
    get loss() {
        return this.simulation.loss;
    }
    set loss(loss) {
        if (loss < 0 || loss > 1) {
            throw new Error("Loss must be a number in [0, 1]");
        }
        this.simulation.loss = loss;
    }
}
