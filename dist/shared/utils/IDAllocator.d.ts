export declare class IDAllocator {
    private readonly positiveIDsPool;
    private readonly negativeIDsPool;
    private nextPositiveID;
    private nextNegativeID;
    private readonly timedIDs;
    private readonly timedFreeAt;
    private timedHead;
    constructor();
    allocate(): number;
    allocateNegative(): number;
    free(...ids: number[]): this;
    freeWithTimeout(id: number, delay?: number, now?: number): this;
    processTimeouts(now?: number): this;
    get pendingTimeouts(): number;
    clear(): this;
}
