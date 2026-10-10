import { EventEmitter } from "./EventEmitter";
import { log } from "./logger";
import { PerfSampler } from "./perfStats";
import { Interval, Timer } from "./timers/timer";
export class Loop extends EventEmitter {
    constructor(step, label, maxRate, speed, fixed = false) {
        super();
        this.label = label;
        this.fixed = fixed;
        this.owed = 0;
        this.counted = 0;
        this.run = (now = performance.now()) => {
            if (!this.running) {
                return;
            }
            this.schedule(this.run);
            const period = 1000 / (this.maxRate || Infinity);
            if (this.fixed && period > 0) {
                this.owed = Math.min(this.owed + now - this.counted, Math.max(Loop.MAX_STEP, period));
                this.counted = now;
                while (this.owed >= period && this.running) {
                    this.owed -= period;
                    this.step(period * this.speed, performance.now());
                }
                return;
            }
            if (now - this.last < period) {
                return;
            }
            this.step(Math.min(now - this.last, Loop.MAX_STEP) * this.speed, now);
        };
        this.events = { start: `${step}Start`, step, end: `${step}End` };
        this.maxRate = maxRate;
        this.speed = speed;
        this.id = 0;
        this.last = 0;
        this.running = false;
        this.samples = new PerfSampler();
        this.statsTimer = new Interval(() => this.report(), 1000, false);
        this.statsTimer.pause();
    }
    resume() {
        if (!this.running) {
            this.running = true;
            this.last = performance.now();
            this.owed = 0;
            this.counted = this.last;
            this.samples.reset(this.last);
            this.schedule(this.run);
            this.statsTimer.resume();
            log(this.label, "The loop has started");
            this.fire("resume");
        }
        return this;
    }
    pause() {
        if (this.running) {
            this.running = false;
            this.cancel();
            this.statsTimer.pause();
            log(this.label, "The loop has stopped");
            this.fire("pause");
        }
        return this;
    }
    destroy() {
        this.statsTimer.clear();
        this.pause();
        this.fire("destroy");
        this.removeAllListeners();
    }
    get paused() {
        return !this.running;
    }
    step(deltaTime, now) {
        const interval = now - this.last;
        this.last = now;
        this.id = this.id === Loop.MAX_ID ? 0 : this.id + 1;
        this.fire(this.events.start, now);
        Timer.runAll(now, this.speed);
        this.fire(this.events.step, deltaTime / 1000, now);
        const end = performance.now();
        this.fire(this.events.end, end - now, end);
        this.samples.push(interval, end - now);
    }
    report() {
        const now = performance.now();
        this.measure(now);
        this.samples.reset(now);
        this.fire("stats", this.stats);
    }
    fire(event, a, b) {
        this.emit.call(this, event, a, b);
    }
}
Loop.MAX_ID = 2 ** 32 - 1;
Loop.MAX_STEP = 100;
