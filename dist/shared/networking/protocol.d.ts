import { BufferReader, type Buffers } from "@nasselk/binarypack";
import type { DecodedData, EncodedData, Schema } from "@nasselk/binaryschema";
export type SchemasFor<S, E extends readonly string[]> = {
    readonly [K in keyof S]: K extends E[number] ? Schema : never;
};
export type Side = {
    readonly events: readonly string[];
    readonly schema?: unknown;
};
export type Contract = {
    readonly in: Side;
    readonly out: Side;
};
export type ContractOf<In extends readonly string[], Out extends readonly string[], InSchemas, OutSchemas> = {
    in: {
        events: In;
        schema: InSchemas;
    };
    out: {
        events: Out;
        schema: OutSchemas;
    };
};
export type InboundEvent<C extends Contract> = C["in"]["events"][number];
export type OutboundEvent<C extends Contract> = C["out"]["events"][number];
export type InboundSchemas<C extends Contract> = NonNullable<C["in"]["schema"]>;
export type OutboundSchemas<C extends Contract> = NonNullable<C["out"]["schema"]>;
export type SendPayload<C extends Contract, K extends OutboundEvent<C>> = K extends keyof OutboundSchemas<C> ? [data: EncodedData<Extract<OutboundSchemas<C>[K], Schema>>] : [data?: Buffers];
export type MessagePayload<C extends Contract, K extends InboundEvent<C>> = K extends keyof InboundSchemas<C> ? DecodedData<Extract<InboundSchemas<C>[K], Schema>> : BufferReader;
export declare const MAX_EVENTS = 256;
export declare class ProtocolChannel {
    readonly events: readonly string[];
    readonly schemas: Readonly<Record<string, Schema>>;
    private readonly codes;
    private readonly label;
    constructor(side: Side | undefined, label: string);
    code(event: string): number;
    name(code: number): string | undefined;
    has(event: string): boolean;
    schema(event: string): Schema | undefined;
}
export declare class Protocol<C extends Contract = Contract> {
    readonly in: ProtocolChannel;
    readonly out: ProtocolChannel;
    constructor(protocol?: {
        readonly in?: Side;
        readonly out?: Side;
    });
    channel(inbound: boolean): ProtocolChannel;
    encode(event: string, data?: Buffers | Record<string, any>, inbound?: boolean): Uint8Array<ArrayBuffer>;
    decode(event: string, reader: BufferReader): any;
}
