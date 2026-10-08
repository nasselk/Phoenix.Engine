import { Loop } from "../../shared/utils/Loop";
import { createTimings, toRate } from "../../shared/utils/perfStats";
export class GameLoop extends Loop {
    constructor(config) {
        super("frame", "Game Loop", config?.FPS ?? Infinity, config?.speed ?? 1);
        this.stats = {
            FPS: 0,
            low99: 0,
            frames: {
                global: createTimings(),
                cpu: createTimings(),
                gpu: createTimings(),
            },
        };
    }
    get maxFrameRate() {
        return this.maxRate;
    }
    set maxFrameRate(value) {
        this.maxRate = value;
    }
    get frameID() {
        return this.id;
    }
    schedule(run) {
        this.next = requestAnimationFrame(run);
    }
    cancel() {
        if (this.next !== undefined) {
            cancelAnimationFrame(this.next);
        }
        this.next = undefined;
    }
    measure(now) {
        const { stats, samples } = this;
        stats.FPS = samples.rate(now);
        stats.low99 = toRate(samples.measureIntervals(stats.frames.global).p99);
        samples.measureExecution(stats.frames.cpu);
    }
}
