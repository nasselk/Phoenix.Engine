import { type JsonValue, SettingsStorage } from "phoenix.engine/client";

export interface Settings<T extends object> {
	/** Every setting, reactive: bind to it, read it in effects. Any change is saved. */
	readonly values: T;
	/** A copy of the defaults it was created with. */
	readonly defaults: T;
	/** Back to the defaults, with nothing left in storage to bring the old values back. */
	reset(): void;
	/** What storage holds at a path like `"audio.volume"`; undefined when that setting was never written. */
	stored(path: string): JsonValue | undefined;
	/** Stop saving changes. */
	stop(): void;
}

/**
 * A game's settings as one reactive object: `defaults` with what storage holds under `key` merged over them,
 * written back whenever any of them changes (only what differs from the defaults; see `SettingsStorage`).
 * Call it once, at the top of a module.
 */
export function createSettings<T extends object>(key: string, defaults: T): Settings<T> {
	const store = new SettingsStorage(key, defaults);
	const values = $state(store.load());

	const stop = $effect.root(() => {
		$effect(() => store.save(values));
	});

	return {
		values,
		defaults: store.defaults,
		reset: () => store.reset(values),
		stored: (path) => store.stored(path),
		stop,
	};
}
