import { randomInt } from "../../libs/math/random.js";

type TimerCallback<T extends any[] = any[]> = (...args: T) => void;

export abstract class Timer<T extends any[] = any[]> {
	private static readonly list: Set<Timer> = new Set();
	private static useCustomLoop: boolean = false;

	protected readonly callback: TimerCallback;
	protected readonly precise: boolean;
	private readonly interval: boolean;
	protected readonly params: T;
	protected delay: number;
	private start: number;
	protected timer?: any;
	private paused: boolean;
	private pausedAt?: number;
	private activeTime: number;

	public constructor(callback: TimerCallback, delay: number | [number, number], interval: boolean = false, customLoop: boolean = Timer.useCustomLoop, ...params: T) {
		this.delay = Array.isArray(delay) ? randomInt(delay[0], delay[1]) : delay;
		this.start = performance.now();
		this.callback = callback;
		this.interval = interval;
		this.precise = customLoop;
		this.params = params;
		this.paused = false;
		this.activeTime = 0;

		if (this.delay <= 0) {
			throw new Error("Timer delay must be positive");
		}

		if (this.precise) {
			Timer.list.add(this);
		}
	}

	public static runAll(now: number = performance.now(), timeScale: number = 1): void {
		// Run it at each frame/tick manually
		for (const timeout of Timer.list) {
			if (now - timeout.start >= timeout.delay / timeScale) {
				if (timeout.interval) {
					timeout.start = now;
				} else {
					Timer.list.delete(timeout);
				}

				timeout.callback(...timeout.params);
			}
		}
	}

	public static setCustomLoop(boolean: boolean): void {
		Timer.useCustomLoop = boolean;
	}

	public static clear(): void {
		Timer.list.clear();
	}

	public pause(): void {
		if (!this.paused) {
			this.paused = true;
			this.pausedAt = performance.now();

			if (this.precise) {
				Timer.list.delete(this);
			} else {
				if (this.interval) {
					clearInterval(this.timer);
				} else {
					clearTimeout(this.timer);
				}
			}
		}
	}

	public resume(): void {
		if (this.paused && this.pausedAt) {
			this.paused = false;
			this.activeTime += performance.now() - this.pausedAt;

			if (this.precise) {
				Timer.list.add(this);
			} else {
				const remaining = Math.max(0, this.delay - this.elapsedTime);

				if (this.interval) {
					this.timer = setInterval(this.callback, this.delay, ...this.params);
				} else {
					this.timer = setTimeout(this.callback, remaining, ...this.params);
				}
			}
		}
	}

	public reschedule(delay: number): void {
		this.delay = delay;

		if (!this.precise) {
			if (this.interval) {
				clearInterval(this.timer);
				this.timer = setInterval(this.callback, this.delay, ...this.params);
			} else {
				clearTimeout(this.timer);
				if (!this.paused) {
					this.timer = setTimeout(this.callback, this.delay - this.elapsedTime, ...this.params);
				}
			}
		}
	}

	public clear(runCallback: boolean = false): void {
		if (runCallback) {
			this.callback(...this.params);
		}

		if (this.precise) {
			Timer.list.delete(this);
		} else {
			if (this.interval) {
				clearInterval(this.timer);
			} else {
				clearTimeout(this.timer);
			}
		}
	}

	public get schedule(): number {
		return this.delay;
	}

	public get elapsedTime(): number {
		if (this.paused && this.pausedAt) {
			return this.pausedAt - this.start + this.activeTime;
		} else {
			return performance.now() - this.start + this.activeTime;
		}
	}

	public get remainingTime(): number {
		return this.delay - this.elapsedTime;
	}

	public get active(): boolean {
		return !this.paused && this.precise ? Timer.list.has(this) : this.timer !== undefined;
	}
}

export class Timeout extends Timer {
	constructor(callback: TimerCallback, delay: number | [number, number], customLoop?: boolean, ...params: any[]) {
		super(callback, delay, false, customLoop, ...params);

		if (!this.precise) {
			this.timer = setTimeout(this.callback, this.delay, ...this.params);
		}
	}
}

export class Interval extends Timer {
	constructor(callback: TimerCallback, delay: number | [number, number], customLoop?: boolean, ...params: any[]) {
		super(callback, delay, true, customLoop, ...params);

		if (!this.precise) {
			this.timer = setInterval(this.callback, this.delay, ...this.params);
		}
	}
}
