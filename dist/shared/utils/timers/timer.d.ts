type TimerCallback<T extends any[] = any[]> = (...args: T) => void;
export declare abstract class Timer<T extends any[] = any[]> {
    private static readonly list;
    private static useCustomLoop;
    protected readonly callback: TimerCallback;
    protected readonly precise: boolean;
    private readonly interval;
    protected readonly params: T;
    protected delay: number;
    private start;
    protected timer?: any;
    private paused;
    private pausedAt?;
    private activeTime;
    constructor(callback: TimerCallback, delay: number | [number, number], interval?: boolean, customLoop?: boolean, ...params: T);
    static runAll(now?: number, timeScale?: number): void;
    static setCustomLoop(boolean: boolean): void;
    static clear(): void;
    pause(): void;
    resume(): void;
    reschedule(delay: number): void;
    clear(runCallback?: boolean): void;
    get schedule(): number;
    get elapsedTime(): number;
    get remainingTime(): number;
    get active(): boolean;
}
export declare class Timeout extends Timer {
    constructor(callback: TimerCallback, delay: number | [number, number], customLoop?: boolean, ...params: any[]);
}
export declare class Interval extends Timer {
    constructor(callback: TimerCallback, delay: number | [number, number], customLoop?: boolean, ...params: any[]);
}
export {};
