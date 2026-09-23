import { type LoadingManager, type Object3D, type WebGLRenderer } from "three";
import { type GLTFLoaderPlugin, type GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import type { AssetLoader } from "../AssetManager";
import { type RequestOptions } from "./request";
export type ModelLoaderOptions = RequestOptions & {
    readonly draco?: string;
    readonly ktx2?: string;
    readonly meshopt?: boolean;
};
export declare class ModelLoader implements AssetLoader<Object3D> {
    private readonly manager;
    private readonly gltf;
    private draco?;
    private ktx2?;
    private readonly decoders;
    private provideRenderer;
    private readonly renderer;
    private destroyed;
    constructor(manager: LoadingManager, options?: ModelLoaderOptions);
    init(renderer: WebGLRenderer): void;
    extend(plugin: (parser: GLTFParser) => GLTFLoaderPlugin): void;
    load(url: string): Promise<Object3D>;
    unload(model: Object3D): void;
    destroy(): void;
    private attachDecoders;
}
