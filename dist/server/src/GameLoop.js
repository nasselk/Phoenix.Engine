import { Interval, Timer } from "../../shared/utils/timers/timer";
import { log } from "../../shared/utils/logger";
import { EventEmitter } from "../../shared/utils/EventEmitter";
import { createTimings, PerfSampler, toRate } from "../../shared/utils/perfStats";
export class GameLoop extends EventEmitter {
    constructor(config) {
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
        };
        this.samples = new PerfSampler();
        this.statsTimer = new Interval(() => this.computeStats(), 1000, false);
        this.statsTimer.pause();
    }
    resume() {
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
    pause() {
        if (!this.paused) {
            if (this.next) {
                if (this.turbo) {
                    clearImmediate(this.next);
                }
                else {
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
    tick() {
        if (this.turbo) {
            this.next = setImmediate(() => this.tick());
        }
        else {
            this.next = setTimeout(() => this.tick(), 1);
        }
        const now = performance.now();
        const deltaTimeCap = (1000 / (this.maxTickRate || Infinity)) * this.speed;
        const interval = now - this.lastTickTime;
        const deltaTime = Math.min(interval, 100) * this.speed;
        if (deltaTime >= deltaTimeCap) {
            this.lastTickTime = now;
            if (this.tickID === Number.MAX_SAFE_INTEGER) {
                this.tickID = 0;
            }
            else {
                this.tickID++;
            }
            this.emit("tickStart", now);
            Timer.runAll(now, this.speed);
            this.emit("tick", deltaTime / 1000, now);
            const now2 = performance.now();
            const tickTime = now2 - now;
            this.emit("tickEnd", tickTime, now2);
            this.samples.push(interval, tickTime);
        }
    }
    computeStats() {
        const stats = this.stats;
        const samples = this.samples;
        const now = performance.now();
        stats.TPS = samples.rate(now);
        stats.low99 = toRate(samples.measureIntervals(stats.ticks).p99);
        samples.measureExecution(stats.mspt);
        samples.reset(now);
        this.emit("stats", stats);
    }
    destroy() {
        this.statsTimer.clear();
        this.pause();
        this.emit("destroy");
        this.removeAllListeners();
    }
    get paused() {
        return this.next === undefined;
    }
}
