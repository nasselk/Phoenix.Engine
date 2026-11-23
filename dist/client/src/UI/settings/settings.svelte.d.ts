import { type JsonValue } from "phoenix.engine/client";
export interface Settings<T extends object> {
    readonly values: T;
    readonly defaults: T;
    reset(): void;
    stored(path: string): JsonValue | undefined;
    stop(): void;
}
export declare function createSettings<T extends object>(key: string, defaults: T): Settings<T>;
//# sourceMappingURL=settings.svelte.d.ts.map