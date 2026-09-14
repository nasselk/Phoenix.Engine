import { Timer } from "../../shared/utils/timers/timer";

import { log } from "../../shared/utils/logger";

import { EventEmitter } from "../../shared/utils/EventEmitter";

type GameLoopEvents = {
	frame: [deltaTime: number, now: number];
	resume: [];
	pause: [];
	destroy: [];
};

export type GameLoopParams = {
	FPS: number;
	speed: number;
};

export class GameLoop extends EventEmitter<GameLoopEvents> {
	/** The maximum frame rate for the rendering loop. */
	public maxFrameRate: number;
	public frameID: number;
	public speed: number;

	private lastFrameTime: number;
	private frames: number;
	private next?: number;
	private mspf: number;

	public constructor(config?: Partial<GameLoopParams>) {
		super();

		this.maxFrameRate = config?.FPS ?? Infinity;
		this.lastFrameTime = 0;
		this.speed = config?.speed ?? 1;
		this.frameID = 0;
		this.frames = 0;
		this.mspf = 0;
	}

	/**
	 * Resumes the rendering loop, allowing the renderer to continuously update and render the scene.
	 * If the rendering loop is already running, this method has no effect.
	 *
	 * @returns The current instance of the RenderSystem for method chaining.
	 *
	 */
	public resume(): this {
		if (this.paused) {
			this.next = requestAnimationFrame((now) => this.frame(now));

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
	 *
	 */
	public pause(): this {
		if (!this.paused) {
			if (this.next) {
				cancelAnimationFrame(this.next);
			}

			this.next = undefined;

			log("Renderer", "The rendering loop has stopped");

			this.emit("pause");
		}

		return this;
	}

	protected frame(now: number = performance.now()): number {
		this.next = requestAnimationFrame((now) => this.frame(now));

		const deltaTimeCap = (1000 / (this.maxFrameRate || Infinity)) * this.speed;
		const deltaTime = Math.min(now - this.lastFrameTime, 100) * this.speed;

		// Account of the FPS cap
		if (deltaTime >= deltaTimeCap) {
			this.lastFrameTime = now;

			// Run timers registered in "precise" mode
			Timer.runAll(now, this.speed);

			if (this.frameID === Number.MAX_SAFE_INTEGER) {
				this.frameID = 0;
			} else {
				this.frameID++;
			}

			// Emit the render event, allowing external listeners to perform actions before the scene is rendered.
			this.emit("frame", deltaTime / 1000, now);

			this.frames++;
			this.mspf += performance.now() - now;
		}

		return performance.now() - now;
	}

	public destroy(): void {
		this.pause();

		this.emit("destroy");

		this.removeAllListeners();
	}

	/** Indicates whether the rendering loop is currently paused. */
	public get paused(): boolean {
		return this.next === undefined;
	}
}
