import { EventEmitter } from "../../shared/utils/EventEmitter";
type GameLoopEvents = {
    tick: [deltaTime: number, now: number];
    resume: [];
    pause: [];
    destroy: [];
};
type GameLoopParams = {
    TPS: number;
    turbo: boolean;
    speed: number;
};
export declare class GameLoop extends EventEmitter<GameLoopEvents> {
    lastTickTime: number;
    speed: number;
    tickID: number;
    TPS: number;
    turbo: boolean;
    private paused;
    private ticks;
    private mspt;
    private next?;
    constructor(config?: Partial<GameLoopParams>);
    resume(): this;
    pause(): this;
    private update;
    destroy(): void;
}
export {};
