import { Loop } from "../../shared/utils/Loop";
import { createTimings, toRate, type Timings } from "../../shared/utils/perfStats";

export type GameLoopParams = {
	TPS: number;
	turbo: boolean;
	speed: number;
};

export type LoopStats = {
	TPS: number;
	low99: number;
	readonly ticks: Timings;
	readonly mspt: Timings;
	readonly memory: {
		total: number;
		heap: number;
		arraybuffer: number;
	};
};

/**
 * The server's loop: fixed ticks of exactly 1 / TPS seconds, as many as the time that passed holds,
 * polled with `setTimeout`, or `setImmediate` in turbo. A server that falls behind catches up with
 * several ticks in a row, up to a tenth of a second's worth; past that it slows down.
 */
export class GameLoop extends Loop<"tick", LoopStats> {
	/** Poll with `setImmediate` instead of a 1 ms `setTimeout`: closer to the rate, at the cost of a busy core. */
	public turbo: boolean;

	public readonly stats: LoopStats;

	private next?: ReturnType<typeof setTimeout> | ReturnType<typeof setImmediate>;
	private immediate = false;

	public constructor(config?: Partial<GameLoopParams>) {
		super("tick", "Game Loop", config?.TPS ?? 60, config?.speed ?? 1, true);

		this.turbo = config?.turbo ?? false;

		this.stats = {
			TPS: 0,
			low99: 0,
			ticks: createTimings(),
			mspt: createTimings(),
			memory: {
				total: 0,
				heap: 0,
				arraybuffer: 0,
			},
		};
	}

	public get maxTickRate(): number {
		return this.maxRate;
	}

	public set maxTickRate(value: number) {
		this.maxRate = value;
	}

	public get tickID(): number {
		return this.id;
	}

	public get lastTickTime(): number {
		return this.last;
	}

	protected schedule(run: () => void): void {
		this.immediate = this.turbo;
		this.next = this.turbo ? setImmediate(run) : setTimeout(run, 1);
	}

	protected cancel(): void {
		if (this.immediate) {
			clearImmediate(this.next as ReturnType<typeof setImmediate>);
		} else {
			clearTimeout(this.next as ReturnType<typeof setTimeout>);
		}

		this.next = undefined;
	}

	protected measure(now: number): void {
		const { stats, samples } = this;
		const memory = process.memoryUsage();

		stats.memory.total = Math.ceil(memory.rss / 1024 / 1024);
		stats.memory.heap = Math.ceil(memory.heapUsed / 1024 / 1024);
		stats.memory.arraybuffer = Math.ceil(memory.arrayBuffers / 1024 / 1024);
		stats.TPS = samples.rate(now);
		stats.low99 = toRate(samples.measureIntervals(stats.ticks).p99);

		samples.measureExecution(stats.mspt);
	}
}
