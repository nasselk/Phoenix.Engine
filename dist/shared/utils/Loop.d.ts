import { EventEmitter } from "./EventEmitter";
import { PerfSampler } from "./perfStats";
export type LoopEvents<Step extends string, Stats> = {
    [K in `${Step}Start`]: [now: number];
} & {
    [K in Step]: [deltaTime: number, now: number];
} & {
    [K in `${Step}End`]: [stepTime: number, now: number];
} & {
    stats: [stats: Stats];
    resume: [];
    pause: [];
    destroy: [];
};
export declare abstract class Loop<Step extends string, Stats> extends EventEmitter<LoopEvents<Step, Stats>> {
    private readonly label;
    private readonly fixed;
    private static readonly MAX_ID;
    private static readonly MAX_STEP;
    speed: number;
    abstract readonly stats: Stats;
    protected maxRate: number;
    protected id: number;
    protected last: number;
    protected readonly samples: PerfSampler;
    private readonly events;
    private readonly statsTimer;
    private running;
    private owed;
    private counted;
    protected constructor(step: Step, label: string, maxRate: number, speed: number, fixed?: boolean);
    protected abstract schedule(run: (now?: number) => void): void;
    protected abstract cancel(): void;
    protected abstract measure(now: number): void;
    resume(): this;
    pause(): this;
    destroy(): void;
    get paused(): boolean;
    private readonly run;
    private step;
    private report;
    private fire;
}
