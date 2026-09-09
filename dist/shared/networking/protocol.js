import { BufferReader, BufferWriter } from "@nasselk/binarypack";
export const MAX_EVENTS = 256;
export class ProtocolChannel {
    constructor(side, label) {
        const events = (side?.events ?? []);
        if (events.length > MAX_EVENTS) {
            throw new RangeError(`A protocol cannot declare more than ${MAX_EVENTS} ${label} events, got ${events.length}`);
        }
        this.events = events;
        this.schemas = (side?.schema ?? {});
        this.codes = new Map();
        this.label = label;
        for (let code = 0; code < events.length; code++) {
            const event = events[code];
            if (this.codes.has(event)) {
                throw new Error(`Duplicate ${label} event "${event}" in the protocol`);
            }
            this.codes.set(event, code);
        }
        for (const event in this.schemas) {
            if (!this.codes.has(event)) {
                throw new Error(`Schema declared for unknown ${label} event "${event}"`);
            }
        }
    }
    code(event) {
        const code = this.codes.get(event);
        if (code === undefined) {
            throw new Error(`Unknown ${this.label} event "${event}"`);
        }
        return code;
    }
    name(code) {
        return this.events[code];
    }
    has(event) {
        return this.codes.has(event);
    }
    schema(event) {
        return this.schemas[event];
    }
}
export class Protocol {
    constructor(protocol) {
        this.in = new ProtocolChannel(protocol?.in, "inbound");
        this.out = new ProtocolChannel(protocol?.out, "outbound");
    }
    channel(inbound) {
        return inbound ? this.in : this.out;
    }
    encode(event, data, inbound = false) {
        const channel = this.channel(inbound);
        const code = channel.code(event);
        if (data instanceof BufferWriter) {
            data.writeUint8(code, 0);
            data.fillOffset();
            return data.bytes;
        }
        else if (!data) {
            const writer = new BufferWriter(1);
            writer.writeUint8(code);
            return writer.bytes;
        }
        else if (data instanceof BufferReader || ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
            const writer = new BufferWriter(data);
            writer.writeUint8(code, 0);
            writer.fillOffset();
            return writer.bytes;
        }
        const schema = channel.schema(event);
        if (!schema) {
            throw new Error(`No ${inbound ? "inbound" : "outbound"} schema for "${event}" and no buffer was provided`);
        }
        const writer = new BufferWriter(1, true);
        writer.writeUint8(code);
        schema.encode(data, writer);
        return writer.bytes;
    }
    decode(event, reader) {
        const schema = this.in.schema(event);
        return schema ? schema.decode(reader) : reader;
    }
}
