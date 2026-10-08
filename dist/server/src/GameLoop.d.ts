import { Loop } from "../../shared/utils/Loop";
import { type Timings } from "../../shared/utils/perfStats";
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
export declare class GameLoop extends Loop<"tick", LoopStats> {
    turbo: boolean;
    readonly stats: LoopStats;
    private next?;
    private immediate;
    constructor(config?: Partial<GameLoopParams>);
    get maxTickRate(): number;
    set maxTickRate(value: number);
    get tickID(): number;
    get lastTickTime(): number;
    protected schedule(run: () => void): void;
    protected cancel(): void;
    protected measure(now: number): void;
}
