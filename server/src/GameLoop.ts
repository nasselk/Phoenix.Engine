import { Timer } from "../../shared/utils/timers/timer";

import { log } from "../../shared/utils/logger";

import { EventEmitter } from "../../shared/utils/EventEmitter";

type GameLoopEvents = {
	tick: [deltaTime: number, now: number];
	resume: [];
	pause: [];
	destroy: [];
};

export type GameLoopParams = {
	TPS: number;
	turbo: boolean;
	speed: number;
};

export class GameLoop extends EventEmitter<GameLoopEvents> {
	public lastTickTime: number;
	public speed: number;
	public maxTickRate: number;
	public turbo: boolean;
	public tickID: number;

	private ticks: number;
	private mspt: number;
	private next?: any; // Timeout or Immediate

	public constructor(config?: Partial<GameLoopParams>) {
		super();

		this.speed = config?.speed ?? 1;
		this.maxTickRate = config?.TPS ?? 60;
		this.turbo = config?.turbo ?? false;
		this.lastTickTime = 0;
		this.tickID = 0;
		this.ticks = 0;
		this.mspt = 0;
	}

	/**
	 * Resumes the game loop, allowing it to continue updating the game state.
	 * If the game loop is already running, this method has no effect.
	 *
	 * @returns The current instance of the GameLoop for method chaining.
	 */
	public resume(): this {
		if (this.paused) {
			this.tick();

			log("Game Loop", "The game loop has started");
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

			log("Game Loop", "The game loop has stopped");
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
		const deltaTime = Math.min(now - this.lastTickTime, 100) * this.speed;

		// If deltaTime is greater or equal to the server maximum tick rate then update the game state
		if (deltaTime >= deltaTimeCap) {
			this.lastTickTime = now;

			if (this.tickID === Number.MAX_SAFE_INTEGER) {
				this.tickID = 0;
			} else {
				this.tickID++;
			}

			// Run timers registered in "eventLoop" mode
			Timer.runAll(now, this.speed);

			this.emit("tick", deltaTime / 1000, now);

			this.ticks++;
			this.mspt += performance.now() - now;
		}
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
