import { warn } from "../../../shared/utils/logger";
import { deepMerge } from "../../../shared/utils/utils";
import { storage } from "./storage";
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function differences(values, defaults, written) {
    const out = {};
    for (const key in values) {
        const value = values[key];
        const other = defaults[key];
        const before = written?.[key];
        if (isObject(value) && isObject(other)) {
            const nested = differences(value, other, isObject(before) ? before : undefined);
            if (Object.keys(nested).length > 0) {
                out[key] = nested;
            }
        }
        else if (before !== undefined || JSON.stringify(value) !== JSON.stringify(other)) {
            out[key] = value;
        }
    }
    return out;
}
export class SettingsStorage {
    constructor(key, defaults) {
        this.key = key;
        this.written = {};
        this.defaults = structuredClone(defaults);
    }
    load() {
        const values = structuredClone(this.defaults);
        const saved = storage.getItem(this.key);
        if (saved === null) {
            return values;
        }
        try {
            const parsed = JSON.parse(saved);
            if (isObject(parsed)) {
                deepMerge(values, parsed);
                this.written = parsed;
            }
        }
        catch (err) {
            warn("Settings", `Ignoring unreadable settings stored under "${this.key}"`, err);
        }
        return values;
    }
    save(values) {
        this.written = differences(values, this.defaults, this.written);
        storage.setItem(this.key, JSON.stringify(this.written));
    }
    reset(values) {
        deepMerge(values, this.defaults);
        this.written = {};
        storage.removeItem(this.key);
    }
    stored(path) {
        let node = this.written;
        for (const key of path.split(".")) {
            if (!isObject(node)) {
                return undefined;
            }
            node = node[key];
        }
        return node;
    }
}
//# sourceMappingURL=settings.js.map