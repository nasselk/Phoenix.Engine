import { type Buffers } from "@nasselk/binarypack";
export declare class BitSet {
    private readonly resizable;
    private bits;
    length: number;
    size: number;
    constructor(size?: number, resizable?: boolean);
    constructor(array: number[] | Set<number>, resizable?: boolean);
    constructor(buffer: Buffers, resizable?: boolean, clone?: boolean);
    constructor(allocation: number | number[] | Set<number> | Buffers, resizable?: boolean, clone?: boolean);
    [Symbol.iterator](): IterableIterator<number>;
    forEach(callback: (value: number, index: number) => void): void;
    add(value: number): void;
    has(value: number): boolean;
    hasAndAdd(value: number): boolean;
    flip(value: number): boolean;
    delete(value: number): void;
    resize(max: number, restore?: boolean): this;
    clear(): this;
    toString(): string;
    get isEmpty(): boolean;
}
