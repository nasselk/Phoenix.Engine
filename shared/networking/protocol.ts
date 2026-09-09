import { BufferReader, BufferWriter, type Buffers } from "@nasselk/binarypack";
import type { DecodedData, EncodedData, Schema } from "@nasselk/binaryschema";

/**
 * Schemas keyed by the events they encode: every key of `S` must name an event of `E`, or be
 * `never`, which nothing satisfies.
 *
 * This is the whole schema check, and it is an ordinary constraint on a constructor's type
 * parameter. Mapping over `keyof S` rather than over `E` is what makes an extra key fail — a map
 * over `E` alone leaves the extra key unconstrained, and a target whose properties are all optional
 * accepts any source that overlaps it at all.
 */
export type SchemasFor<S, E extends readonly string[]> = { readonly [K in keyof S]: K extends E[number] ? Schema : never };

/**
 * One direction of the wire contract: the events that travel it, and how their payloads are encoded.
 *
 * An event's index in `events` *is* its one-byte code on the wire, so the client's `out` list and
 * the server's `in` list must match exactly and may only be appended to — and likewise for the
 * other direction. The two directions are independent: neither the names nor their order has to
 * line up between `in` and `out`, which is the whole point of splitting them.
 *
 * Events without a schema still work; they carry a raw buffer instead of a decoded object.
 */
export type Side = { readonly events: readonly string[]; readonly schema?: unknown };

/**
 * The wire contract as seen from one end of a connection: `in` is what this side receives, `out` is
 * what it sends, so a client's `out` is the server's `in`.
 *
 * This is the widest form — what a generic parameter is constrained by, never what you declare. A
 * declaration is a plain settings object, and {@link ContractOf} reassembles this from the pieces
 * inferred off it.
 */
export type Contract = { readonly in: Side; readonly out: Side };

/** The contract a settings object declares, rebuilt from the four pieces its constructor infers. */
export type ContractOf<In extends readonly string[], Out extends readonly string[], InSchemas, OutSchemas> = {
	in: { events: In; schema: InSchemas };
	out: { events: Out; schema: OutSchemas };
};

/** The events a contract can receive, as a union of their literal names. */
export type InboundEvent<C extends Contract> = C["in"]["events"][number];

/** The events a contract can send, as a union of their literal names. */
export type OutboundEvent<C extends Contract> = C["out"]["events"][number];

/** The inbound schema map, with the optionality of `schema` collapsed away. */
export type InboundSchemas<C extends Contract> = NonNullable<C["in"]["schema"]>;

/** The outbound schema map, with the optionality of `schema` collapsed away. */
export type OutboundSchemas<C extends Contract> = NonNullable<C["out"]["schema"]>;

/** Argument list of `send(event, ...)`: the schema's data when the event has one, an optional raw buffer otherwise. */
export type SendPayload<C extends Contract, K extends OutboundEvent<C>> = K extends keyof OutboundSchemas<C> ? [data: EncodedData<Extract<OutboundSchemas<C>[K], Schema>>] : [data?: Buffers];

/** What a handler for `event` receives: the decoded data when the event has a schema, the raw reader otherwise. */
export type MessagePayload<C extends Contract, K extends InboundEvent<C>> = K extends keyof InboundSchemas<C> ? DecodedData<Extract<InboundSchemas<C>[K], Schema>> : BufferReader;

/** The event code is a single byte, so that is the ceiling on how many events one direction can declare. */
export const MAX_EVENTS = 256;

/**
 * The runtime half of a {@link Side}: one direction's event ⇄ code table and its schemas.
 *
 * Inbound and outbound each get their own instance, so an event name may sit at a different code in
 * each direction — or, more usually, exist in only one of them.
 */
export class ProtocolChannel {
	/** Index = wire code. */
	public readonly events: readonly string[];
	public readonly schemas: Readonly<Record<string, Schema>>;
	private readonly codes: Map<string, number>;
	/** "inbound" or "outbound": only ever used to make an error say which direction is at fault. */
	private readonly label: string;

	public constructor(side: Side | undefined, label: string) {
		const events = (side?.events ?? []) as readonly string[];

		if (events.length > MAX_EVENTS) {
			throw new RangeError(`A protocol cannot declare more than ${MAX_EVENTS} ${label} events, got ${events.length}`);
		}

		this.events = events;
		this.schemas = (side?.schema ?? {}) as Readonly<Record<string, Schema>>;
		this.codes = new Map();
		this.label = label;

		for (let code = 0; code < events.length; code++) {
			const event = events[code]!;

			// Two events sharing a name would share a code, so one of them could never be addressed.
			if (this.codes.has(event)) {
				throw new Error(`Duplicate ${label} event "${event}" in the protocol`);
			}

			this.codes.set(event, code);
		}

		// A schema for an event nobody declared silently never runs — say so instead.
		for (const event in this.schemas) {
			if (!this.codes.has(event)) {
				throw new Error(`Schema declared for unknown ${label} event "${event}"`);
			}
		}
	}

	/** The wire code of an event. Throws on an unknown name — that is a programming error, not input. */
	public code(event: string): number {
		const code = this.codes.get(event);

		if (code === undefined) {
			throw new Error(`Unknown ${this.label} event "${event}"`);
		}

		return code;
	}

	/** The event a wire code names, or `undefined` when the code is out of range (untrusted input). */
	public name(code: number): string | undefined {
		return this.events[code];
	}

	public has(event: string): boolean {
		return this.codes.has(event);
	}

	public schema(event: string): Schema | undefined {
		return this.schemas[event];
	}
}

/**
 * The runtime half of a {@link Contract}: the two event ⇄ code tables and the framing.
 *
 * Both sides build one from their own protocol object, which is why the client and the server can
 * share every byte of the encoding logic and only differ in which channel is "in" and which is
 * "out".
 *
 * A frame is `[event code: uint8][payload]` — the code written from the sender's `out` table and
 * read back against the receiver's `in` one, which is why those two lists are the pair that has to
 * agree. The payload is whatever the event's schema wrote, or the caller's raw bytes when it has
 * none.
 */
export class Protocol<C extends Contract = Contract> {
	/** What this side receives: the table incoming codes are resolved against. */
	public readonly in: ProtocolChannel;
	/** What this side sends: the table outgoing codes are written from. */
	public readonly out: ProtocolChannel;

	/** No protocol at all is a protocol: both channels come up empty, so neither direction can name an event. */
	public constructor(protocol?: { readonly in?: Side; readonly out?: Side }) {
		this.in = new ProtocolChannel(protocol?.in, "inbound");
		this.out = new ProtocolChannel(protocol?.out, "outbound");
	}

	/** The channel a direction names, `inbound` being the flag the framing methods already take. */
	public channel(inbound: boolean): ProtocolChannel {
		return inbound ? this.in : this.out;
	}

	/**
	 * Frame an outgoing message.
	 *
	 * @param event The event name. Must be declared in the channel being encoded for.
	 * @param data Either the schema's data, or raw bytes for a schema-less event. A `BufferWriter`
	 *   or buffer is written in place: byte 0 is overwritten with the event code, so a caller
	 *   building its own payload must leave that byte free.
	 * @param inbound Encode against the inbound channel instead of the outbound one — only used to
	 *   fabricate a message that is about to be fed back into this side's own handlers, where both
	 *   the code and the schema have to come from the receiving table.
	 */
	public encode(event: string, data?: Buffers | Record<string, any>, inbound: boolean = false): Uint8Array<ArrayBuffer> {
		const channel = this.channel(inbound);
		const code = channel.code(event);

		if (data instanceof BufferWriter) {
			data.writeUint8(code, 0);

			data.fillOffset();

			return data.bytes as Uint8Array<ArrayBuffer>;
		} else if (!data) {
			const writer = new BufferWriter(1);

			writer.writeUint8(code);

			return writer.bytes as Uint8Array<ArrayBuffer>;
		} else if (data instanceof BufferReader || ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
			const writer = new BufferWriter(data);

			writer.writeUint8(code, 0);

			writer.fillOffset();

			return writer.bytes as Uint8Array<ArrayBuffer>;
		}

		const schema = channel.schema(event);

		if (!schema) {
			throw new Error(`No ${inbound ? "inbound" : "outbound"} schema for "${event}" and no buffer was provided`);
		}

		const writer = new BufferWriter(1, true);

		writer.writeUint8(code);

		schema.encode(data as any, writer);

		return writer.bytes as Uint8Array<ArrayBuffer>;
	}

	/**
	 * Decode a payload whose event code has already been read off `reader`.
	 *
	 * Events without an inbound schema hand back the reader itself, positioned right after the
	 * event byte, so a handler can read the payload however it likes.
	 */
	public decode(event: string, reader: BufferReader): any {
		const schema = this.in.schema(event);

		return schema ? schema.decode(reader) : reader;
	}
}
