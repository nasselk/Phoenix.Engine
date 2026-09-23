import { type LoadingManager, type Texture } from "three";
import type { AssetLoader } from "../AssetManager";
import { type RequestOptions } from "./request";
export declare class TextureLoader implements AssetLoader<Texture> {
    private readonly loader;
    constructor(manager: LoadingManager, options?: RequestOptions);
    load(url: string): Promise<Texture>;
    unload(texture: Texture): void;
}
