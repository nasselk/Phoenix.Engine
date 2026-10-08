import { Loop } from "../../shared/utils/Loop";
import { type Timings } from "../../shared/utils/perfStats";
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
export declare class GameLoop extends Loop<"frame", LoopStats> {
    readonly stats: LoopStats;
    private next?;
    constructor(config?: Partial<GameLoopParams>);
    get maxFrameRate(): number;
    set maxFrameRate(value: number);
    get frameID(): number;
    protected schedule(run: (now: number) => void): void;
    protected cancel(): void;
    protected measure(now: number): void;
}
