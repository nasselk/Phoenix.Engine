import type { JsonValue } from "../../../shared/utils/types";
export declare class SettingsStorage<T extends object> {
    readonly key: string;
    readonly defaults: T;
    private written;
    constructor(key: string, defaults: T);
    load(): T;
    save(values: T): void;
    reset(values: T): void;
    stored(path: string): JsonValue | undefined;
}
//# sourceMappingURL=settings.d.ts.map