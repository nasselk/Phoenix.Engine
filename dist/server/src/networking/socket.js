import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { warn } from "../../../shared/utils/logger";
import { Seen } from "../world/replication";
export var SocketState;
(function (SocketState) {
    SocketState[SocketState["CONNECTING"] = 0] = "CONNECTING";
    SocketState[SocketState["OPEN"] = 1] = "OPEN";
    SocketState[SocketState["CLOSING"] = 2] = "CLOSING";
    SocketState[SocketState["CLOSED"] = 3] = "CLOSED";
})(SocketState || (SocketState = {}));
export class Socket extends EventEmitter {
    constructor(protocol, socket, id) {
        super();
        this.id = id;
        this.socket = socket;
        this.protocol = protocol;
        this.ip = socket.data.ip ?? socket.remoteAddress;
        this.lastMessage = performance.now();
        this.messages = 0;
        this.rates = new CounterMap();
        this.manuallyDisconnected = false;
        this.seen = new Seen();
        this.data = {};
    }
    send(event, ...[data]) {
        if (this.readyState === SocketState.OPEN) {
            const buffer = this.protocol.encode(event, data);
            this.socket.send(buffer);
        }
        return this;
    }
    broadcast(topic, event, ...[data]) {
        this.socket.publish(topic, this.protocol.encode(event, data));
        return this;
    }
    cork(callback) {
        this.socket.cork(() => callback(this));
        return this;
    }
    subscribe(topic) {
        this.socket.subscribe(topic);
        return this;
    }
    unsubscribe(topic) {
        this.socket.unsubscribe(topic);
        return this;
    }
    resetRates() {
        this.messages = 0;
        this.rates.clear();
    }
    disconnect(reason = "", code = 1000) {
        if (code !== 1000) {
            warn("Game Server", `Disconnecting ${this.ip} with code ${code} - ${reason}`);
        }
        this.manuallyDisconnected = true;
        if (this.readyState === SocketState.CONNECTING || this.readyState === SocketState.OPEN) {
            this.socket.close(code, reason);
        }
    }
    terminate() {
        this.manuallyDisconnected = true;
        if (this.readyState === SocketState.CONNECTING || this.readyState === SocketState.OPEN) {
            this.socket.terminate();
        }
    }
    disconnection(code, reason) {
        this.emit("disconnection", code, reason, this.manuallyDisconnected);
        this.removeAllListeners();
    }
    get readyState() {
        return this.socket?.readyState ?? SocketState.CLOSED;
    }
}
