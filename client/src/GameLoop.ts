import { Timer } from "../../shared/utils/timers/timer";

import { log } from "../../shared/utils/logger";

import { EventEmitter } from "../../shared/utils/EventEmitter";

type GameLoopEvents = {
	frame: [deltaTime: number, now: number];
	resume: [];
	pause: [];
	destroy: [];
};

export class GameLoop extends EventEmitter<GameLoopEvents> {
	protected lastFrameTime: number;

	/** The maximum frame rate for the rendering loop. */
	public targetFrameRate: number;

	/** Indicates whether the rendering loop is currently paused. */
	public paused: boolean;

	protected frames: number;
	protected loop?: number;

	public constructor() {
		super();

		this.paused = true;
		this.targetFrameRate = Infinity;
		this.lastFrameTime = 0;
		this.frames = 0;
	}

	/**
	 * Resumes the rendering loop, allowing the renderer to continuously update and render the scene.
	 * If the rendering loop is already running, this method has no effect.
	 *
	 * @returns The current instance of the RenderSystem for method chaining.
	 *
	 * @throws Error if the renderer is not initialized. Call init() before resuming the rendering loop.
	 */
	public resume(): this {
		if (this.paused) {
			this.loop = requestAnimationFrame((now) => this.frame(now));
			this.paused = false;

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
	 * @throws Error if the renderer is not initialized. Call init() before pausing the rendering loop.
	 */
	public pause(): this {
		if (!this.paused) {
			if (this.loop) {
				cancelAnimationFrame(this.loop);
			}

			this.paused = true;

			log("Renderer", "The rendering loop has stopped");

			this.emit("pause");
		}

		return this;
	}

	/**
	 * The main rendering function that is called on each animation frame. It calculates the time delta since the last frame, runs any registered timers, and renders the scene using the renderer.
	 *
	 * @param now Optional current timestamp in milliseconds, typically provided by requestAnimationFrame.
	 * @returns The time taken to execute the rendering function in milliseconds.
	 * @throws Error if the renderer is not initialized. Call init() before starting the rendering loop.
	 */
	protected frame(now: number = performance.now()): number {
		this.loop = requestAnimationFrame((now) => this.frame(now));

		const minDeltaTime = 1000 / this.targetFrameRate;
		const deltaTime = now - this.lastFrameTime;

		// Account of the FPS cap
		if (deltaTime >= minDeltaTime && !document.hidden) {
			// Run timers registered in "precise" mode
			Timer.runAll(now);

			this.lastFrameTime = now;
			this.frames++;

			// Emit the render event, allowing external listeners to perform actions before the scene is rendered.
			this.emit("frame", deltaTime, now);
		}

		return performance.now() - now;
	}

	public destroy(): void {
		this.pause();

		this.emit("destroy");

		this.removeAllListeners();
	}
}
