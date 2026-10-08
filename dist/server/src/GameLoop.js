import { Loop } from "../../shared/utils/Loop";
import { createTimings, toRate } from "../../shared/utils/perfStats";
export class GameLoop extends Loop {
    constructor(config) {
        super("tick", "Game Loop", config?.TPS ?? 60, config?.speed ?? 1);
        this.immediate = false;
        this.turbo = config?.turbo ?? false;
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
    }
    get maxTickRate() {
        return this.maxRate;
    }
    set maxTickRate(value) {
        this.maxRate = value;
    }
    get tickID() {
        return this.id;
    }
    get lastTickTime() {
        return this.last;
    }
    schedule(run) {
        this.immediate = this.turbo;
        this.next = this.turbo ? setImmediate(run) : setTimeout(run, 1);
    }
    cancel() {
        if (this.immediate) {
            clearImmediate(this.next);
        }
        else {
            clearTimeout(this.next);
        }
        this.next = undefined;
    }
    measure(now) {
        const { stats, samples } = this;
        const memory = process.memoryUsage();
        stats.memory.total = Math.ceil(memory.rss / 1024 / 1024);
        stats.memory.heap = Math.ceil(memory.heapUsed / 1024 / 1024);
        stats.memory.arraybuffer = Math.ceil(memory.arrayBuffers / 1024 / 1024);
        stats.TPS = samples.rate(now);
        stats.low99 = toRate(samples.measureIntervals(stats.ticks).p99);
        samples.measureExecution(stats.mspt);
    }
}
