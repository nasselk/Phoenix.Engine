import { CounterMap } from "../../../shared/utils/CounterMap";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { warn } from "../../../shared/utils/logger";
export class Socket extends EventEmitter {
    constructor(protocol, socket, id) {
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
    send(event, ...[data]) {
        if (this.readyState === 1) {
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
    disconnect(forcefully, reason = "", code = 1000) {
        if (code !== 1000) {
            warn("Game Server", `Disconnecting ${this.ip} with code ${code} - ${reason}`);
        }
        this.manuallyDisconnected = true;
        if (this.readyState === 0 || this.readyState === 1) {
            if (forcefully) {
                this.socket.terminate();
            }
            else {
                this.socket.close(code, reason);
            }
        }
    }
    disconnection(code, reason) {
        this.emit("disconnection", code, reason, this.manuallyDisconnected);
        this.removeAllListeners();
    }
    get readyState() {
        return this.socket?.readyState ?? 3;
    }
}
