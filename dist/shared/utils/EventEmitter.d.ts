export declare class EventEmitter<Events extends Record<string, any[]>> {
    private readonly listeners;
    on<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void): () => void;
    off<K extends keyof Events>(event: K, callback: (...args: Events[K]) => void): void;
    removeAllListeners(): void;
    protected emit<K extends keyof Events>(event: K, ...args: Events[K]): void;
}
