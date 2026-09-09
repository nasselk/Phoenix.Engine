import { Timer } from "../../shared/utils/timers/timer";
import { log } from "../../shared/utils/logger";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export class GameLoop extends EventEmitter {
    constructor() {
        super();
        this.paused = true;
        this.targetFrameRate = Infinity;
        this.lastFrameTime = 0;
        this.frames = 0;
    }
    resume() {
        if (this.paused) {
            this.loop = requestAnimationFrame((now) => this.frame(now));
            this.paused = false;
            log("Renderer", "The rendering loop has started");
            this.emit("resume");
        }
        return this;
    }
    pause() {
        if (!this.paused) {
            if (this.loop) {
                cancelAnimationFrame(this.loop);
            }
            this.paused = true;
            log("Renderer", "The rendering loop has stopped");
            this.emit("pause");
        }
        return this;
    }
    frame(now = performance.now()) {
        this.loop = requestAnimationFrame((now) => this.frame(now));
        const minDeltaTime = 1000 / this.targetFrameRate;
        const deltaTime = now - this.lastFrameTime;
        if (deltaTime >= minDeltaTime && !document.hidden) {
            Timer.runAll(now);
            this.lastFrameTime = now;
            this.frames++;
            this.emit("frame", deltaTime, now);
        }
        return performance.now() - now;
    }
    destroy() {
        this.pause();
        this.emit("destroy");
        this.removeAllListeners();
    }
}
