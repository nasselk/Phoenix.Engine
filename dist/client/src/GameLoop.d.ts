import { EventEmitter } from "../../shared/utils/EventEmitter";
import { type Timings } from "../../shared/utils/perfStats";
type GameLoopEvents = {
    frameStart: [now: number];
    frame: [deltaTime: number, now: number];
    frameEnd: [frameTime: number, now: number];
    stats: [stats: LoopStats];
    resume: [];
    pause: [];
    destroy: [];
};
export type GameLoopParams = {
    FPS: number;
    speed: number;
};
export type LoopStats = {
    FPS: number;
    low99: number;
    readonly frames: {
        readonly global: Timings;
        readonly cpu: Timings;
        readonly gpu: Timings;
    };
};
export declare class GameLoop extends EventEmitter<GameLoopEvents> {
    maxFrameRate: number;
    frameID: number;
    speed: number;
    private lastFrameTime;
    private next?;
    private readonly statsTimer;
    private readonly samples;
    readonly stats: LoopStats;
    constructor(config?: Partial<GameLoopParams>);
    resume(): this;
    pause(): this;
    protected frame(now?: number): number;
    private computeStats;
    destroy(): void;
    get paused(): boolean;
}
export {};
