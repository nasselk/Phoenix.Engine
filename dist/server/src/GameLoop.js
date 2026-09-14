import { Timer } from "../../shared/utils/timers/timer";
import { log } from "../../shared/utils/logger";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export class GameLoop extends EventEmitter {
    constructor(config) {
        super();
        this.speed = config?.speed ?? 1;
        this.maxTickRate = config?.TPS ?? 60;
        this.turbo = config?.turbo ?? false;
        this.lastTickTime = 0;
        this.tickID = 0;
        this.ticks = 0;
        this.mspt = 0;
    }
    resume() {
        if (this.paused) {
            this.tick();
            log("Game Loop", "The game loop has started");
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
            log("Game Loop", "The game loop has stopped");
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
        const deltaTime = Math.min(now - this.lastTickTime, 100) * this.speed;
        if (deltaTime >= deltaTimeCap) {
            this.lastTickTime = now;
            if (this.tickID === Number.MAX_SAFE_INTEGER) {
                this.tickID = 0;
            }
            else {
                this.tickID++;
            }
            Timer.runAll(now, this.speed);
            this.emit("tick", deltaTime / 1000, now);
            this.ticks++;
            this.mspt += performance.now() - now;
        }
    }
    destroy() {
        this.pause();
        this.emit("destroy");
        this.removeAllListeners();
    }
    get paused() {
        return this.next === undefined;
    }
}
