import { Howl, type HowlOptions } from "howler";
import type { AssetLoader } from "../AssetManager";

/**
 * A sound's file, or several of the same sound in different formats — the first the browser can
 * play wins — with anything Howler has to know before loading: a sprite map, or `html5` to stream
 * long music instead of decoding it whole.
 */
export type SoundSource = string | (Omit<HowlOptions, "src" | "preload" | "onload" | "onloaderror"> & { readonly src: string | readonly string[] });

export class SoundLoader implements AssetLoader<Howl, SoundSource> {
	/** Resolves once the sound can play, and rejects with the reason when none of its files load. */
	public load(source: SoundSource): Promise<Howl> {
		const { src, ...options } = typeof source === "string" ? { src: source } : source;

		return new Promise((resolve, reject) => {
			const howl: Howl = new Howl({
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

	public unload(howl: Howl): void {
		howl.unload();
	}
}
