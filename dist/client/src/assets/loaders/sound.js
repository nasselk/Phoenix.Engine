import { Howl } from "howler";
export class SoundLoader {
    load(source) {
        const { src, ...options } = typeof source === "string" ? { src: source } : source;
        return new Promise((resolve, reject) => {
            const howl = new Howl({
                ...options,
                src: typeof src === "string" ? [src] : [...src],
                preload: true,
                onload: () => resolve(howl),
                onloaderror: (_id, error) => {
                    howl.unload();
                    reject(new Error(`Could not load sound ${String(src)}: ${String(error)}`));
                },
            });
        });
    }
    unload(howl) {
        howl.unload();
    }
}
