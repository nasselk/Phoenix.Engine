import { randomInt } from "../../math/random";

type TimerCallback<T extends any[] = any[]> = (...args: T) => void;

export abstract class Timer<T extends any[] = any[]> {
	private static readonly list: Set<Timer> = new Set();
	private static useCustomLoop: boolean = false;

	protected readonly callback: TimerCallback;
	protected readonly precise: boolean;
	private readonly interval: boolean;
	protected readonly params: T;
	protected delay: number;
	/** When the current period began, moved forward by every pause so that paused time never counts. */
	private start: number;
	protected timer?: ReturnType<typeof setTimeout>;
	private paused: boolean;
	private pausedAt: number;
	private finished: boolean;

	public constructor(callback: TimerCallback, delay: number | [number, number], interval: boolean = false, customLoop: boolean = Timer.useCustomLoop, ...params: T) {
		this.delay = Array.isArray(delay) ? randomInt(delay[0], delay[1]) : delay;
		this.start = performance.now();
		this.callback = callback;
		this.interval = interval;
		this.precise = customLoop;
		this.params = params;
		this.paused = false;
		this.pausedAt = 0;
		this.finished = false;

		if (this.delay <= 0) {
			throw new Error("Timer delay must be positive");
		}

		if (this.precise) {
			Timer.list.add(this);
		} else {
			this.arm(this.delay);
		}
	}

	public static runAll(now: number = performance.now(), timeScale: number = 1): void {
		for (const timer of Timer.list) {
			if (now - timer.start >= timer.delay / timeScale) {
				timer.fire(now);
			}
		}
	}

	public static setCustomLoop(boolean: boolean): void {
		Timer.useCustomLoop = boolean;
	}

	public static clear(): void {
		for (const timer of Timer.list) {
			timer.finished = true;
		}

		Timer.list.clear();
	}

	private readonly onTimeout = (): void => {
		this.timer = undefined;
		this.fire(performance.now());
	};

	private fire(now: number): void {
		if (this.interval) {
			this.start = now;

			if (!this.precise) {
				this.arm(this.delay);
			}
		} else {
			this.finished = true;
			Timer.list.delete(this);
		}

		this.callback(...this.params);
	}

	private arm(milliseconds: number): void {
		clearTimeout(this.timer);

		this.timer = setTimeout(this.onTimeout, Math.max(0, milliseconds));
	}

	private disarm(): void {
		Timer.list.delete(this);
		clearTimeout(this.timer);

		this.timer = undefined;
	}

	public pause(): void {
		if (this.paused || this.finished) {
			return;
		}

		this.paused = true;
		this.pausedAt = performance.now();
		this.disarm();
	}

	public resume(): void {
		if (!this.paused || this.finished) {
			return;
		}

		this.paused = false;
		this.start += performance.now() - this.pausedAt;

		if (this.precise) {
			Timer.list.add(this);
		} else {
			this.arm(this.remainingTime);
		}
	}

	/** Change the delay. The time already elapsed in the current period still counts toward it. */
	public reschedule(delay: number): void {
		this.delay = delay;

		if (!this.precise && !this.paused && !this.finished) {
			this.arm(this.remainingTime);
		}
	}

	public clear(runCallback: boolean = false): void {
		if (runCallback) {
			this.callback(...this.params);
		}

		this.finished = true;
		this.disarm();
	}

	public get schedule(): number {
		return this.delay;
	}

	/** Time spent running in the current period, paused time excluded. */
	public get elapsedTime(): number {
		return (this.paused ? this.pausedAt : performance.now()) - this.start;
	}

	public get remainingTime(): number {
		return this.delay - this.elapsedTime;
	}

	/** Whether it will still fire: not paused, not cleared, and, for a timeout, not fired yet. */
	public get active(): boolean {
		return !this.paused && !this.finished;
	}
}

export class Timeout extends Timer {
	constructor(callback: TimerCallback, delay: number | [number, number], customLoop?: boolean, ...params: any[]) {
		super(callback, delay, false, customLoop, ...params);
	}
}

export class Interval extends Timer {
	constructor(callback: TimerCallback, delay: number | [number, number], customLoop?: boolean, ...params: any[]) {
		super(callback, delay, true, customLoop, ...params);
	}
}
