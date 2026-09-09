import { EventEmitter } from "../../shared/utils/EventEmitter";
type GameLoopEvents = {
    frame: [deltaTime: number, now: number];
    resume: [];
    pause: [];
    destroy: [];
};
export declare class GameLoop extends EventEmitter<GameLoopEvents> {
    protected lastFrameTime: number;
    targetFrameRate: number;
    paused: boolean;
    protected frames: number;
    protected loop?: number;
    constructor();
    resume(): this;
    pause(): this;
    protected frame(now?: number): number;
    destroy(): void;
}
export {};
