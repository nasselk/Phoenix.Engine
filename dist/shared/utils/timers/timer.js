import { randomInt } from "../../math/random";
export class Timer {
    constructor(callback, delay, interval = false, customLoop = Timer.useCustomLoop, ...params) {
        this.delay = Array.isArray(delay) ? randomInt(delay[0], delay[1]) : delay;
        this.start = performance.now();
        this.callback = callback;
        this.interval = interval;
        this.precise = customLoop;
        this.params = params;
        this.paused = false;
        this.activeTime = 0;
        if (this.delay <= 0) {
            throw new Error("Timer delay must be positive");
        }
        if (this.precise) {
            Timer.list.add(this);
        }
    }
    static runAll(now = performance.now(), timeScale = 1) {
        for (const timeout of Timer.list) {
            if (now - timeout.start >= timeout.delay / timeScale) {
                if (timeout.interval) {
                    timeout.start = now;
                }
                else {
                    Timer.list.delete(timeout);
                }
                timeout.callback(...timeout.params);
            }
        }
    }
    static setCustomLoop(boolean) {
        Timer.useCustomLoop = boolean;
    }
    static clear() {
        Timer.list.clear();
    }
    pause() {
        if (!this.paused) {
            this.paused = true;
            this.pausedAt = performance.now();
            if (this.precise) {
                Timer.list.delete(this);
            }
            else {
                if (this.interval) {
                    clearInterval(this.timer);
                }
                else {
                    clearTimeout(this.timer);
                }
            }
        }
    }
    resume() {
        if (this.paused && this.pausedAt) {
            this.paused = false;
            this.activeTime += performance.now() - this.pausedAt;
            if (this.precise) {
                Timer.list.add(this);
            }
            else {
                const remaining = Math.max(0, this.delay - this.elapsedTime);
                if (this.interval) {
                    this.timer = setInterval(this.callback, this.delay, ...this.params);
                }
                else {
                    this.timer = setTimeout(this.callback, remaining, ...this.params);
                }
            }
        }
    }
    reschedule(delay) {
        this.delay = delay;
        if (!this.precise) {
            if (this.interval) {
                clearInterval(this.timer);
                this.timer = setInterval(this.callback, this.delay, ...this.params);
            }
            else {
                clearTimeout(this.timer);
                if (!this.paused) {
                    this.timer = setTimeout(this.callback, this.delay - this.elapsedTime, ...this.params);
                }
            }
        }
    }
    clear(runCallback = false) {
        if (runCallback) {
            this.callback(...this.params);
        }
        if (this.precise) {
            Timer.list.delete(this);
        }
        else {
            if (this.interval) {
                clearInterval(this.timer);
            }
            else {
                clearTimeout(this.timer);
            }
        }
    }
    get schedule() {
        return this.delay;
    }
    get elapsedTime() {
        if (this.paused && this.pausedAt) {
            return this.pausedAt - this.start + this.activeTime;
        }
        else {
            return performance.now() - this.start + this.activeTime;
        }
    }
    get remainingTime() {
        return this.delay - this.elapsedTime;
    }
    get active() {
        return !this.paused && this.precise ? Timer.list.has(this) : this.timer !== undefined;
    }
}
Timer.list = new Set();
Timer.useCustomLoop = false;
export class Timeout extends Timer {
    constructor(callback, delay, customLoop, ...params) {
        super(callback, delay, false, customLoop, ...params);
        if (!this.precise) {
            this.timer = setTimeout(this.callback, this.delay, ...this.params);
        }
    }
}
export class Interval extends Timer {
    constructor(callback, delay, customLoop, ...params) {
        super(callback, delay, true, customLoop, ...params);
        if (!this.precise) {
            this.timer = setInterval(this.callback, this.delay, ...this.params);
        }
    }
}
