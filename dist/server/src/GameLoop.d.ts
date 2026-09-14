import { EventEmitter } from "../../shared/utils/EventEmitter";
type GameLoopEvents = {
    tick: [deltaTime: number, now: number];
    resume: [];
    pause: [];
    destroy: [];
};
export type GameLoopParams = {
    TPS: number;
    turbo: boolean;
    speed: number;
};
export declare class GameLoop extends EventEmitter<GameLoopEvents> {
    lastTickTime: number;
    speed: number;
    maxTickRate: number;
    turbo: boolean;
    tickID: number;
    private ticks;
    private mspt;
    private next?;
    constructor(config?: Partial<GameLoopParams>);
    resume(): this;
    pause(): this;
    private tick;
    destroy(): void;
    get paused(): boolean;
}
export {};
