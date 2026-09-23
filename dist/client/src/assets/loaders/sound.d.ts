import { Howl, type HowlOptions } from "howler";
import type { AssetLoader } from "../AssetManager";
export type SoundSource = string | (Omit<HowlOptions, "src" | "preload" | "onload" | "onloaderror"> & {
    readonly src: string | readonly string[];
});
export declare class SoundLoader implements AssetLoader<Howl, SoundSource> {
    load(source: SoundSource): Promise<Howl>;
    unload(howl: Howl): void;
}
