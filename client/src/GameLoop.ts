import { Loop } from "../../shared/utils/Loop";
import { createTimings, toRate, type Timings } from "../../shared/utils/perfStats";

export type GameLoopParams = {
	FPS: number;
	speed: number;
};

export type LoopStats = {
	FPS: number;
	low99: number;
	readonly frames: {
		readonly global: Timings;
		readonly cpu: Timings;
		readonly gpu: Timings;
	};
};

/** The client's loop: a frame per display refresh, through `requestAnimationFrame`, capped at `maxFrameRate`. */
export class GameLoop extends Loop<"frame", LoopStats> {
	public readonly stats: LoopStats;

	private next?: number;

	public constructor(config?: Partial<GameLoopParams>) {
		super("frame", "Game Loop", config?.FPS ?? Infinity, config?.speed ?? 1);

		this.stats = {
			FPS: 0,
			low99: 0,
			frames: {
				global: createTimings(),
				cpu: createTimings(),
				gpu: createTimings(),
			},
		};
	}

	/** The maximum frame rate; `Infinity` for the display's. */
	public get maxFrameRate(): number {
		return this.maxRate;
	}

	public set maxFrameRate(value: number) {
		this.maxRate = value;
	}

	public get frameID(): number {
		return this.id;
	}

	protected schedule(run: (now: number) => void): void {
		this.next = requestAnimationFrame(run);
	}

	protected cancel(): void {
		if (this.next !== undefined) {
			cancelAnimationFrame(this.next);
		}

		this.next = undefined;
	}

	protected measure(now: number): void {
		const { stats, samples } = this;

		stats.FPS = samples.rate(now);
		stats.low99 = toRate(samples.measureIntervals(stats.frames.global).p99);

		samples.measureExecution(stats.frames.cpu);
	}
}
