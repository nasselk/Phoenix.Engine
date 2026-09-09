export declare class CounterMap<K> {
    private readonly map;
    private readonly min;
    private readonly max;
    constructor(min?: number, max?: number);
    increment(key: K, amount?: number): number;
    decrement(key: K, amount?: number): number;
    delete(key: K): boolean;
    getCount(key: K): number;
    has(key: K): boolean;
    outOfBounds(key: K, min?: number, max?: number): boolean;
    clear(): void;
}
