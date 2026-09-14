import { EventEmitter } from "../../shared/utils/EventEmitter";
type GameLoopEvents = {
    frame: [deltaTime: number, now: number];
    resume: [];
    pause: [];
    destroy: [];
};
export type GameLoopParams = {
    FPS: number;
    speed: number;
};
export declare class GameLoop extends EventEmitter<GameLoopEvents> {
    maxFrameRate: number;
    frameID: number;
    speed: number;
    private lastFrameTime;
    private frames;
    private next?;
    private mspf;
    constructor(config?: Partial<GameLoopParams>);
    resume(): this;
    pause(): this;
    protected frame(now?: number): number;
    destroy(): void;
    get paused(): boolean;
}
export {};
