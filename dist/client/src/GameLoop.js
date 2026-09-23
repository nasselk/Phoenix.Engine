import { Interval, Timer } from "../../shared/utils/timers/timer";
import { log } from "../../shared/utils/logger";
import { EventEmitter } from "../../shared/utils/EventEmitter";
import { createTimings, PerfSampler, toRate } from "../../shared/utils/perfStats";
export class GameLoop extends EventEmitter {
    constructor(config) {
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
    resume() {
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
    pause() {
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
    frame(now = performance.now()) {
        this.next = requestAnimationFrame((now) => this.frame(now));
        const deltaTimeCap = (1000 / (this.maxFrameRate || Infinity)) * this.speed;
        const interval = now - this.lastFrameTime;
        const deltaTime = Math.min(interval, 100) * this.speed;
        if (deltaTime >= deltaTimeCap) {
            this.lastFrameTime = now;
            if (this.frameID === Number.MAX_SAFE_INTEGER) {
                this.frameID = 0;
            }
            else {
                this.frameID++;
            }
            this.emit("frameStart", now);
            Timer.runAll(now, this.speed);
            this.emit("frame", deltaTime / 1000, now);
            const now2 = performance.now();
            const frameTime = now2 - now;
            this.emit("frameEnd", frameTime, now2);
            this.samples.push(interval, frameTime);
        }
        return performance.now() - now;
    }
    computeStats() {
        const stats = this.stats;
        const samples = this.samples;
        const now = performance.now();
        stats.FPS = samples.rate(now);
        stats.low99 = toRate(samples.measureIntervals(stats.frames.global).p99);
        samples.measureExecution(stats.frames.cpu);
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
