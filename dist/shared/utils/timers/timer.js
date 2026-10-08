import { randomInt } from "../../math/random";
export class Timer {
    constructor(callback, delay, interval = false, customLoop = Timer.useCustomLoop, ...params) {
        this.onTimeout = () => {
            this.timer = undefined;
            this.fire(performance.now());
        };
        this.delay = Array.isArray(delay) ? randomInt(delay[0], delay[1]) : delay;
        this.start = performance.now();
        this.callback = callback;
        this.interval = interval;
        this.precise = customLoop;
        this.params = params;
        this.paused = false;
        this.pausedAt = 0;
        this.finished = false;
        if (this.delay <= 0) {
            throw new Error("Timer delay must be positive");
        }
        if (this.precise) {
            Timer.list.add(this);
        }
        else {
            this.arm(this.delay);
        }
    }
    static runAll(now = performance.now(), timeScale = 1) {
        for (const timer of Timer.list) {
            if (now - timer.start >= timer.delay / timeScale) {
                timer.fire(now);
            }
        }
    }
    static setCustomLoop(boolean) {
        Timer.useCustomLoop = boolean;
    }
    static clear() {
        for (const timer of Timer.list) {
            timer.finished = true;
        }
        Timer.list.clear();
    }
    fire(now) {
        if (this.interval) {
            this.start = now;
            if (!this.precise) {
                this.arm(this.delay);
            }
        }
        else {
            this.finished = true;
            Timer.list.delete(this);
        }
        this.callback(...this.params);
    }
    arm(milliseconds) {
        clearTimeout(this.timer);
        this.timer = setTimeout(this.onTimeout, Math.max(0, milliseconds));
    }
    disarm() {
        Timer.list.delete(this);
        clearTimeout(this.timer);
        this.timer = undefined;
    }
    pause() {
        if (this.paused || this.finished) {
            return;
        }
        this.paused = true;
        this.pausedAt = performance.now();
        this.disarm();
    }
    resume() {
        if (!this.paused || this.finished) {
            return;
        }
        this.paused = false;
        this.start += performance.now() - this.pausedAt;
        if (this.precise) {
            Timer.list.add(this);
        }
        else {
            this.arm(this.remainingTime);
        }
    }
    reschedule(delay) {
        this.delay = delay;
        if (!this.precise && !this.paused && !this.finished) {
            this.arm(this.remainingTime);
        }
    }
    clear(runCallback = false) {
        if (runCallback) {
            this.callback(...this.params);
        }
        this.finished = true;
        this.disarm();
    }
    get schedule() {
        return this.delay;
    }
    get elapsedTime() {
        return (this.paused ? this.pausedAt : performance.now()) - this.start;
    }
    get remainingTime() {
        return this.delay - this.elapsedTime;
    }
    get active() {
        return !this.paused && !this.finished;
    }
}
Timer.list = new Set();
Timer.useCustomLoop = false;
export class Timeout extends Timer {
    constructor(callback, delay, customLoop, ...params) {
        super(callback, delay, false, customLoop, ...params);
    }
}
export class Interval extends Timer {
    constructor(callback, delay, customLoop, ...params) {
        super(callback, delay, true, customLoop, ...params);
    }
}
