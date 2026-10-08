import { EventEmitter } from "./EventEmitter";
import { log } from "./logger";
import { PerfSampler } from "./perfStats";
import { Interval, Timer } from "./timers/timer";

/** A loop's events, named after its step: `tickStart`, `tick`, `tickEnd` on the server, `frame…` on the client. */
export type LoopEvents<Step extends string, Stats> = { [K in `${Step}Start`]: [now: number] } & { [K in Step]: [deltaTime: number, now: number] } & { [K in `${Step}End`]: [stepTime: number, now: number] } & {
	stats: [stats: Stats];
	resume: [];
	pause: [];
	destroy: [];
};

/**
 * What both sides' game loops share: the rate cap, the step's delta (capped at a tenth of a second
 * after a stall, scaled by `speed`), the step counter, the timers driven by the loop, and the samples
 * behind the stats. A side only says how the next run is scheduled and what its stats hold.
 */
export abstract class Loop<Step extends string, Stats> extends EventEmitter<LoopEvents<Step, Stats>> {
	private static readonly MAX_ID = 2 ** 32 - 1;
	private static readonly MAX_STEP = 100;

	/** How fast time passes: 2 steps the world twice as far per step. */
	public speed: number;

	public abstract readonly stats: Stats;

	/** Steps per second at most; `Infinity` for as many as the scheduler offers. */
	protected maxRate: number;
	protected id: number;
	protected last: number;
	protected readonly samples: PerfSampler;

	private readonly events: { readonly start: string; readonly step: string; readonly end: string };
	private readonly statsTimer: Interval;
	private running: boolean;

	protected constructor(
		step: Step,
		private readonly label: string,
		maxRate: number,
		speed: number,
	) {
		super();

		this.events = { start: `${step}Start`, step, end: `${step}End` };
		this.maxRate = maxRate;
		this.speed = speed;
		this.id = 0;
		this.last = 0;
		this.running = false;
		this.samples = new PerfSampler();
		this.statsTimer = new Interval(() => this.report(), 1000, false);
		this.statsTimer.pause();
	}

	/** Arrange for `run` to be called again soon. */
	protected abstract schedule(run: (now?: number) => void): void;

	/** Cancel what `schedule` arranged. */
	protected abstract cancel(): void;

	/** Fill `stats` from `samples`, once a second. */
	protected abstract measure(now: number): void;

	/** Start stepping. Does nothing while running. */
	public resume(): this {
		if (!this.running) {
			this.running = true;
			this.last = performance.now();
			this.samples.reset(this.last);
			this.schedule(this.run);
			this.statsTimer.resume();

			log(this.label, "The loop has started");

			this.fire("resume");
		}

		return this;
	}

	/** Stop stepping. Does nothing while paused. */
	public pause(): this {
		if (this.running) {
			this.running = false;
			this.cancel();
			this.statsTimer.pause();

			log(this.label, "The loop has stopped");

			this.fire("pause");
		}

		return this;
	}

	public destroy(): void {
		this.statsTimer.clear();
		this.pause();
		this.fire("destroy");
		this.removeAllListeners();
	}

	public get paused(): boolean {
		return !this.running;
	}

	private readonly run = (now: number = performance.now()): void => {
		if (!this.running) {
			return;
		}

		this.schedule(this.run);

		const interval = now - this.last;
		const deltaTime = Math.min(interval, Loop.MAX_STEP) * this.speed;

		if (deltaTime < (1000 / (this.maxRate || Infinity)) * this.speed) {
			return;
		}

		this.last = now;
		this.id = this.id === Loop.MAX_ID ? 0 : this.id + 1;

		this.fire(this.events.start, now);

		Timer.runAll(now, this.speed);

		this.fire(this.events.step, deltaTime / 1000, now);

		const end = performance.now();

		this.fire(this.events.end, end - now, end);
		this.samples.push(interval, end - now);
	};

	private report(): void {
		const now = performance.now();

		this.measure(now);
		this.samples.reset(now);
		this.fire("stats", this.stats);
	}

	/** The event names are built from the step's name at runtime, which the emitter's types cannot follow. */
	private fire(event: string, a?: unknown, b?: unknown): void {
		(this.emit as (event: string, a?: unknown, b?: unknown) => void).call(this, event, a, b);
	}
}
