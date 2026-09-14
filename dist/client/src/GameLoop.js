import { Timer } from "../../shared/utils/timers/timer";
import { log } from "../../shared/utils/logger";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export class GameLoop extends EventEmitter {
    constructor(config) {
        super();
        this.maxFrameRate = config?.FPS ?? Infinity;
        this.lastFrameTime = 0;
        this.speed = config?.speed ?? 1;
        this.frameID = 0;
        this.frames = 0;
        this.mspf = 0;
    }
    resume() {
        if (this.paused) {
            this.next = requestAnimationFrame((now) => this.frame(now));
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
            log("Renderer", "The rendering loop has stopped");
            this.emit("pause");
        }
        return this;
    }
    frame(now = performance.now()) {
        this.next = requestAnimationFrame((now) => this.frame(now));
        const deltaTimeCap = (1000 / (this.maxFrameRate || Infinity)) * this.speed;
        const deltaTime = Math.min(now - this.lastFrameTime, 100) * this.speed;
        if (deltaTime >= deltaTimeCap) {
            this.lastFrameTime = now;
            Timer.runAll(now, this.speed);
            if (this.frameID === Number.MAX_SAFE_INTEGER) {
                this.frameID = 0;
            }
            else {
                this.frameID++;
            }
            this.emit("frame", deltaTime / 1000, now);
            this.frames++;
            this.mspf += performance.now() - now;
        }
        return performance.now() - now;
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
