export const MAX_SAMPLES = 2024;
export function createTimings() {
    return { avg: 0, min: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
}
export function toRate(ms) {
    return ms > 0 ? 1000 / ms : 0;
}
export function percentile(sorted, quantile) {
    return sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))];
}
export function measure(samples, count, scratch, out) {
    if (count === 0) {
        out.avg = 0;
        out.min = 0;
        out.max = 0;
        out.p50 = 0;
        out.p90 = 0;
        out.p95 = 0;
        out.p99 = 0;
        return out;
    }
    let total = 0;
    for (let i = 0; i < count; i++) {
        const value = samples[i];
        scratch[i] = value;
        total += value;
    }
    const sorted = scratch.subarray(0, count).sort();
    out.avg = total / count;
    out.min = sorted[0];
    out.max = sorted[count - 1];
    out.p50 = percentile(sorted, 0.5);
    out.p90 = percentile(sorted, 0.9);
    out.p95 = percentile(sorted, 0.95);
    out.p99 = percentile(sorted, 0.99);
    return out;
}
export class PerfSampler {
    constructor(capacity = MAX_SAMPLES) {
        if (capacity < 1) {
            throw new Error(`Sampler capacity must be at least 1, got ${capacity}`);
        }
        this.capacity = capacity;
        this.intervals = new Float64Array(capacity);
        this.execution = new Float64Array(capacity);
        this.scratch = new Float64Array(capacity);
        this.count = 0;
        this.index = 0;
        this.total = 0;
        this.since = 0;
    }
    get samples() {
        return this.count;
    }
    get counted() {
        return this.total;
    }
    push(interval, execution) {
        const index = this.index;
        this.intervals[index] = interval;
        this.execution[index] = execution;
        this.index = (index + 1) % this.capacity;
        this.count = Math.min(this.count + 1, this.capacity);
        this.total++;
    }
    measureIntervals(out) {
        return measure(this.intervals, this.count, this.scratch, out);
    }
    measureExecution(out) {
        return measure(this.execution, this.count, this.scratch, out);
    }
    rate(now = performance.now()) {
        const elapsed = now - this.since;
        return elapsed > 0 ? (this.total * 1000) / elapsed : 0;
    }
    reset(now = performance.now()) {
        this.count = 0;
        this.index = 0;
        this.total = 0;
        this.since = now;
    }
}
