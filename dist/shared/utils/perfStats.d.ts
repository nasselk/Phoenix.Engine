export type Timings = {
    ms: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
};
export declare const MAX_SAMPLES = 2024;
export declare function createTimings(): Timings;
export declare function toRate(ms: number): number;
export declare function percentile(sorted: Float64Array, quantile: number): number;
export declare function measure(samples: Float64Array, count: number, scratch: Float64Array, out: Timings): Timings;
export declare class PerfSampler {
    readonly capacity: number;
    private readonly intervals;
    private readonly execution;
    private readonly scratch;
    private count;
    private index;
    private total;
    private since;
    constructor(capacity?: number);
    get samples(): number;
    get counted(): number;
    push(interval: number, execution: number): void;
    measureIntervals(out: Timings): Timings;
    measureExecution(out: Timings): Timings;
    rate(now?: number): number;
    reset(now?: number): void;
}
