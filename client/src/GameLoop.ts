import { Interval, Timer } from "../../shared/utils/timers/timer";

import { log } from "../../shared/utils/logger";

import { EventEmitter } from "../../shared/utils/EventEmitter";

import { createTimings, PerfSampler, toRate, type Timings } from "../../shared/utils/perfStats";

type GameLoopEvents = {
	frameStart: [now: number];
	frame: [deltaTime: number, now: number];
	frameEnd: [frameTime: number, now: number];
	stats: [stats: LoopStats];
	resume: [];
	pause: [];
	destroy: [];
};

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

export class GameLoop extends EventEmitter<GameLoopEvents> {
	/** The maximum frame rate for the rendering loop. */
	public maxFrameRate: number;
	public frameID: number;
	public speed: number;

	private lastFrameTime: number;
	private next?: number;

	private readonly statsTimer: Interval;
	private readonly samples: PerfSampler;
	public readonly stats: LoopStats;

	public constructor(config?: Partial<GameLoopParams>) {
		super();

		this.maxFrameRate = config?.FPS ?? Infinity;
		this.lastFrameTime = 0;
		this.speed = config?.speed ?? 1;
		this.frameID = 0;

		this.stats = {
			FPS: 0,
			low99: 0,
			frames: {
				global: createTimings(),
				cpu: createTimings(),
				gpu: createTimings(),
			},
		};

		this.samples = new PerfSampler();

		this.statsTimer = new Interval(() => this.computeStats(), 1000, false);

		this.statsTimer.pause();
	}

	/**
	 * Resumes the rendering loop, allowing the renderer to continuously update and render the scene.
	 * If the rendering loop is already running, this method has no effect.
	 *
	 * @returns The current instance of the RenderSystem for method chaining.
	 */
	public resume(): this {
		if (this.paused) {
			this.lastFrameTime = performance.now();

			this.samples.reset(this.lastFrameTime);

			this.next = requestAnimationFrame((now) => this.frame(now));

			this.statsTimer.resume();

			log("Renderer", "The rendering loop has started");

			this.emit("resume");
		}

		return this;
	}

	/**
	 * Pauses the rendering loop, halting the continuous update and rendering of the scene.
	 * If the rendering loop is already paused, this method has no effect.
	 *
	 * @returns The current instance of the RenderSystem for method chaining.
	 */
	public pause(): this {
		if (!this.paused) {
			if (this.next) {
				cancelAnimationFrame(this.next);
			}

			this.next = undefined;

			this.statsTimer.pause();

			log("Renderer", "The rendering loop has stopped");

			this.emit("pause");
		}

		return this;
	}

	protected frame(now: number = performance.now()): number {
		this.next = requestAnimationFrame((now) => this.frame(now));

		const deltaTimeCap = (1000 / (this.maxFrameRate || Infinity)) * this.speed;
		const interval = now - this.lastFrameTime;
		const deltaTime = Math.min(interval, 100) * this.speed;

		// Account of the FPS cap
		if (deltaTime >= deltaTimeCap) {
			this.lastFrameTime = now;

			if (this.frameID === Number.MAX_SAFE_INTEGER) {
				this.frameID = 0;
			} else {
				this.frameID++;
			}

			this.emit("frameStart", now);

			// Run timers registered in "precise" mode
			Timer.runAll(now, this.speed);

			// Emit the render event, allowing external listeners to perform actions before the scene is rendered.
			this.emit("frame", deltaTime / 1000, now);

			const now2 = performance.now();
			const frameTime = now2 - now;

			this.emit("frameEnd", frameTime, now2);

			this.samples.push(interval, frameTime);
		}

		return performance.now() - now;
	}

	private computeStats(): void {
		const stats = this.stats;
		const samples = this.samples;
		const now = performance.now();

		stats.FPS = samples.rate(now);
		stats.low99 = toRate(samples.measureIntervals(stats.frames.global).p99);

		samples.measureExecution(stats.frames.cpu);
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
