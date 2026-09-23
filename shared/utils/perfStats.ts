export type Timings = {
	ms: number;
	min: number;
	max: number;
	p50: number;
	p90: number;
	p95: number;
	p99: number;
};

export const MAX_SAMPLES = 2024;

export function createTimings(): Timings {
	return { ms: 0, min: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
}

export function toRate(ms: number): number {
	return ms > 0 ? 1000 / ms : 0;
}

export function percentile(sorted: Float64Array, quantile: number): number {
	return sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))]!;
}

export function measure(samples: Float64Array, count: number, scratch: Float64Array, out: Timings): Timings {
	if (count === 0) {
		out.ms = 0;
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
		const value = samples[i]!;

		scratch[i] = value;
		total += value;
	}

	const sorted = scratch.subarray(0, count).sort();

	out.ms = total / count;
	out.min = sorted[0]!;
	out.max = sorted[count - 1]!;
	out.p50 = percentile(sorted, 0.5);
	out.p90 = percentile(sorted, 0.9);
	out.p95 = percentile(sorted, 0.95);
	out.p99 = percentile(sorted, 0.99);

	return out;
}

export class PerfSampler {
	public readonly capacity: number;

	private readonly intervals: Float64Array;
	private readonly execution: Float64Array;
	private readonly scratch: Float64Array;

	private count: number;
	private index: number;
	private total: number;
	private since: number;

	public constructor(capacity: number = MAX_SAMPLES) {
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

	public get samples(): number {
		return this.count;
	}

	public get counted(): number {
		return this.total;
	}

	public push(interval: number, execution: number): void {
		const index = this.index;

		this.intervals[index] = interval;
		this.execution[index] = execution;

		this.index = (index + 1) % this.capacity;
		this.count = Math.min(this.count + 1, this.capacity);
		this.total++;
	}

	public measureIntervals(out: Timings): Timings {
		return measure(this.intervals, this.count, this.scratch, out);
	}

	public measureExecution(out: Timings): Timings {
		return measure(this.execution, this.count, this.scratch, out);
	}

	public rate(now: number = performance.now()): number {
		const elapsed = now - this.since;

		return elapsed > 0 ? (this.total * 1000) / elapsed : 0;
	}

	public reset(now: number = performance.now()): void {
		this.count = 0;
		this.index = 0;
		this.total = 0;
		this.since = now;
	}
}
