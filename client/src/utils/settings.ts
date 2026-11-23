import { warn } from "../../../shared/utils/logger";
import type { JsonObject, JsonValue } from "../../../shared/utils/types";
import { deepMerge } from "../../../shared/utils/utils";
import { storage } from "./storage";

function isObject(value: unknown): value is JsonObject {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** What `values` has that `defaults` does not, plus every key already `written`, keeping the shape nested. */
function differences(values: JsonObject, defaults: JsonObject, written: JsonObject | undefined): JsonObject {
	const out: JsonObject = {};

	for (const key in values) {
		const value = values[key]!;
		const other = defaults[key];
		const before = written?.[key];

		if (isObject(value) && isObject(other)) {
			const nested = differences(value, other, isObject(before) ? before : undefined);

			if (Object.keys(nested).length > 0) {
				out[key] = nested;
			}
		} else if (before !== undefined || JSON.stringify(value) !== JSON.stringify(other)) {
			out[key] = value;
		}
	}

	return out;
}

/**
 * A game's settings in `storage`, under one key. Only what differs from the defaults is written, so a default
 * that changes in a later version reaches players who never touched it. A key once written stays written,
 * even set back to its default, so a player who chose that value keeps it.
 */
export class SettingsStorage<T extends object> {
	/** A copy of the defaults it was given. */
	public readonly defaults: T;
	private written: JsonObject = {};

	public constructor(
		public readonly key: string,
		defaults: T,
	) {
		this.defaults = structuredClone(defaults);
	}

	/** The defaults with what storage holds merged over them; the defaults alone when it holds nothing readable. */
	public load(): T {
		const values = structuredClone(this.defaults);
		const saved = storage.getItem(this.key);

		if (saved === null) {
			return values;
		}

		try {
			const parsed: unknown = JSON.parse(saved);

			if (isObject(parsed)) {
				deepMerge(values as JsonObject, parsed);

				this.written = parsed;
			}
		} catch (err) {
			warn("Settings", `Ignoring unreadable settings stored under "${this.key}"`, err);
		}

		return values;
	}

	/** Writes what `values` changed from the defaults. */
	public save(values: T): void {
		this.written = differences(values as JsonObject, this.defaults as JsonObject, this.written);

		storage.setItem(this.key, JSON.stringify(this.written));
	}

	/** Puts `values` back to the defaults, and forgets everything stored. */
	public reset(values: T): void {
		deepMerge(values as JsonObject, this.defaults as JsonObject);

		this.written = {};

		storage.removeItem(this.key);
	}

	/** What storage holds at a path like `"audio.volume"`; undefined when that setting was never written. */
	public stored(path: string): JsonValue | undefined {
		let node: JsonValue | undefined = this.written;

		for (const key of path.split(".")) {
			if (!isObject(node)) {
				return undefined;
			}

			node = node[key];
		}

		return node;
	}
}
