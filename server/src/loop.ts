import { Interval, Timer } from "../../../../shared/utils/timers/timer.js";

import { Lockers } from "../../../../shared/libs/buffer/sharedBuffer.js";

import { DynamicEntity } from "./entities/dynamicEntity.js";

import GameServer, { SharedUpdateType } from "./game.js";

import { GameClient } from "./client.js";

import { log } from "../../../../shared/utils/logger.js";

import { InputListener } from "./inputs/handler.js";

import { Entity } from "./entities/entity.js";

import { ThreadEvents } from "../events.js";
import { removeFromArray } from "../../../../shared/utils/utils.js";

export class GameLoop {
	private lastNetworkingTick: number;
	private lastTick: number;
	private paused: boolean;
	private speed: number;
	private ticks: number;
	public tickID: number;
	private mspt: number;
	private next?: any; // Timeout or Immediate

	public constructor() {
		this.lastTick = 0;
		this.lastNetworkingTick = 0;
		this.paused = true; // Start paused until start() is called
		this.tickID = 0;
		this.ticks = 0;
		this.speed = 1;
		this.mspt = 0;

		this.setTimers();
	}

	public stop(): this {
		if (!this.paused) {
			if (this.next) {
				if (GameServer.config.turbo) {
					clearImmediate(this.next);
				} else {
					clearTimeout(this.next);
				}

				this.next = undefined;
			}

			this.paused = true;

			log("Game Loop", "The game loop has stopped");
		}

		return this;
	}

	public update(now: number = performance.now()): void {
		if (GameServer.config.turbo) {
			this.next = setImmediate(this.update.bind(this));
		} else {
			// 1 bcs setTimeout is not accurate anyways
			this.next = setTimeout(this.update.bind(this), 1);
		}

		const deltaTimeCap = (1000 / (GameServer.config.TPS || Infinity)) * this.speed;
		const deltaTime = Math.min(now - this.lastTick, 1000) * this.speed;

		// If deltaTime is greater or equal to the server maximum tick rate then update the game state
		if (deltaTime >= deltaTimeCap) {
			this.lastTick = now;

			if (this.paused) {
				return;
			} else if (this.tickID === Number.MAX_SAFE_INTEGER) {
				this.tickID = 0;
			} else {
				this.tickID++;
			}

			// Run timers registered in "eventLoop" mode
			Timer.runAll(now, this.speed);

			// Return IDs whose post-destroy reuse delay has elapsed (FIFO drain in
			// the allocator, replaces a per-destroy Timeout). Every tick, like above.
			GameServer.spawner.IDAllocator.processTimeouts(now);

			this.ticks++;
			this.mspt += performance.now() - now;
		}
	}

	private displayStats(delay: number): this {
		const avgTPS = Math.ceil((this.ticks / delay) * 1000);
		const avgMSPT = Number((this.mspt / this.ticks).toFixed(2));
		const memoryUsage = Math.round(process.memoryUsage().rss / 1024 / 1024);

		log("Game Loop", GameServer.sessions.size, "/", GameServer.config.networking.sessions.maximum, "players", "·", Entity.list.size, "entities", "·", avgTPS, "TPS", "·", avgMSPT, "mspt", "·", memoryUsage + "MB");

		return this;
	}
}
