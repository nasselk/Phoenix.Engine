export class MessageHandlers {
    constructor(channel) {
        this.channel = channel;
        this.handlers = [];
    }
    add(event, handler) {
        const code = this.channel.code(event);
        if (this.handlers[code] !== undefined) {
            throw new Error(`"${event}" already has a handler; remove it with the function its onMessage returned first`);
        }
        this.handlers[code] = handler;
        return () => {
            if (this.handlers[code] === handler) {
                this.handlers[code] = undefined;
            }
        };
    }
    get(code) {
        return this.handlers[code];
    }
}
