import { SettingsStorage } from "phoenix.engine/client";
export function createSettings(key, defaults) {
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
//# sourceMappingURL=settings.svelte.js.map