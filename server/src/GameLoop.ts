import { Interval, Timer } from "../../shared/utils/timers/timer";

import { log } from "../../shared/utils/logger";

import { EventEmitter } from "../../shared/utils/EventEmitter";

import { createTimings, PerfSampler, toRate, type Timings } from "../../shared/utils/perfStats";

type GameLoopEvents = {
	tickStart: [now: number];
	tick: [deltaTime: number, now: number];
	tickEnd: [tickTime: number, now: number];
	stats: [stats: LoopStats];
	resume: [];
	pause: [];
	destroy: [];
};

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

export class GameLoop extends EventEmitter<GameLoopEvents> {
	public lastTickTime: number;
	public speed: number;
	public maxTickRate: number;
	public turbo: boolean;
	public tickID: number;

	private next?: any; // Timeout or Immediate

	private readonly statsTimer: Interval;
	private readonly samples: PerfSampler;
	public readonly stats: LoopStats;

	public constructor(config?: Partial<GameLoopParams>) {
		super();

		this.speed = config?.speed ?? 1;
		this.maxTickRate = config?.TPS ?? 60;
		this.turbo = config?.turbo ?? false;
		this.lastTickTime = 0;
		this.tickID = 0;

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

		this.samples = new PerfSampler();

		this.statsTimer = new Interval(() => this.computeStats(), 1000, false);

		this.statsTimer.pause();
	}

	/**
	 * Resumes the game loop, allowing it to continue updating the game state.
	 * If the game loop is already running, this method has no effect.
	 *
	 * @returns The current instance of the GameLoop for method chaining.
	 */
	public resume(): this {
		if (this.paused) {
			this.lastTickTime = performance.now();

			this.samples.reset(this.lastTickTime);

			this.tick();

			this.statsTimer.resume();

			log("Game Loop", "The game loop has started");

			this.emit("resume");
		}

		return this;
	}

	/**
	 * Pauses the game loop, halting the continuous update of the game state.
	 * If the game loop is already paused, this method has no effect.
	 *
	 * @returns The current instance of the GameLoop for method chaining.
	 */
	public pause(): this {
		if (!this.paused) {
			if (this.next) {
				if (this.turbo) {
					clearImmediate(this.next);
				} else {
					clearTimeout(this.next);
				}

				this.next = undefined;
			}

			this.statsTimer.pause();

			log("Game Loop", "The game loop has stopped");

			this.emit("pause");
		}

		return this;
	}

	private tick(): void {
		if (this.turbo) {
			this.next = setImmediate(() => this.tick());
		} else {
			// 1 bcs setTimeout is not accurate anyways
			this.next = setTimeout(() => this.tick(), 1);
		}

		const now = performance.now();

		const deltaTimeCap = (1000 / (this.maxTickRate || Infinity)) * this.speed;
		const interval = now - this.lastTickTime;
		const deltaTime = Math.min(interval, 100) * this.speed;

		// If deltaTime is greater or equal to the server maximum tick rate then update the game state
		if (deltaTime >= deltaTimeCap) {
			this.lastTickTime = now;

			if (this.tickID === Number.MAX_SAFE_INTEGER) {
				this.tickID = 0;
			} else {
				this.tickID++;
			}

			this.emit("tickStart", now);

			// Run timers registered in "eventLoop" mode
			Timer.runAll(now, this.speed);

			this.emit("tick", deltaTime / 1000, now);

			const now2 = performance.now();
			const tickTime = now2 - now;

			this.emit("tickEnd", tickTime, now2);

			this.samples.push(interval, tickTime);
		}
	}

	private computeStats(): void {
		const stats = this.stats;
		const samples = this.samples;
		const now = performance.now();
		const memory = process.memoryUsage();

		stats.memory.total = memory.rss / 1024 / 1024;
		stats.memory.heap = memory.heapUsed / 1024 / 1024;
		stats.memory.arraybuffer = memory.arrayBuffers / 1024 / 1024;
		stats.TPS = samples.rate(now);
		stats.low99 = toRate(samples.measureIntervals(stats.ticks).p99);

		samples.measureExecution(stats.mspt);
		samples.reset(now);

		this.emit("stats", stats);
	}

	public destroy(): void {
		this.statsTimer.clear();
		this.pause();

		this.emit("destroy");

		this.removeAllListeners();
	}

	/** Indicates whether the rendering loop is currently paused. */
	public get paused(): boolean {
		return this.next === undefined;
	}
}
