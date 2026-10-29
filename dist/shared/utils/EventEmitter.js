export class EventEmitter {
    constructor() {
        this.listeners = new Map();
    }
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }
    off(event, callback) {
        this.listeners.get(event)?.delete(callback);
    }
    removeAllListeners() {
        this.listeners.clear();
    }
    emit(event, ...args) {
        const callbacks = this.listeners.get(event);
        if (callbacks !== undefined) {
            for (const callback of callbacks) {
                callback(...args);
            }
        }
    }
    emitUnchecked(event, a, b) {
        const callbacks = this.listeners.get(event);
        if (callbacks !== undefined) {
            for (const callback of callbacks) {
                callback(a, b);
            }
        }
    }
}
//# sourceMappingURL=EventEmitter.js.map