import { EventEmitter } from "../../shared/utils/EventEmitter";
import { type Timings } from "../../shared/utils/perfStats";
type GameLoopEvents = {
    tickStart: [now: number];
    tick: [deltaTime: number, now: number];
    tickEnd: [tickTime: number, now: number];
    stats: [stats: LoopStats];
    resume: [];
    pause: [];
    destroy: [];
};
export type GameLoopParams = {
    TPS: number;
    turbo: boolean;
    speed: number;
};
export type LoopStats = {
    TPS: number;
    low99: number;
    readonly ticks: Timings;
    readonly mspt: Timings;
    readonly memory: {
        total: number;
        heap: number;
        arraybuffer: number;
    };
};
export declare class GameLoop extends EventEmitter<GameLoopEvents> {
    lastTickTime: number;
    speed: number;
    maxTickRate: number;
    turbo: boolean;
    tickID: number;
    private next?;
    private readonly statsTimer;
    private readonly samples;
    readonly stats: LoopStats;
    constructor(config?: Partial<GameLoopParams>);
    resume(): this;
    pause(): this;
    private tick;
    private computeStats;
    destroy(): void;
    get paused(): boolean;
}
export {};
