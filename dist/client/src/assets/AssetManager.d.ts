import { LoadingManager, type Object3D, type WebGLRenderer } from "three";
import type { GLTFLoaderPlugin, GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { AssetCache, type AssetKind, type AssetKinds } from "./AssetCache";
import { type SoundSource } from "./loaders/sound";
export interface AssetSources {
    model: string;
    texture: string;
    sound: SoundSource;
}
export type AssetSource<K extends AssetKind> = K extends keyof AssetSources ? AssetSources[K] : string;
export interface AssetLoader<T, S = string> {
    load(source: S): Promise<T>;
    unload?(asset: T): void;
}
export type AssetManagerOptions = {
    readonly path?: string;
    readonly draco?: string;
    readonly ktx2?: string;
    readonly meshopt?: boolean;
    readonly crossOrigin?: string;
    readonly headers?: Readonly<Record<string, string>>;
};
export type AssetManifest = {
    readonly [K in AssetKind]?: Readonly<Record<string, AssetSource<K>>>;
};
type AssetManagerEvents = {
    progress: [loaded: number, total: number];
    complete: [];
    load: [kind: AssetKind, id: string];
    error: [kind: AssetKind, id: string, error: unknown];
};
export declare class AssetManager extends EventEmitter<AssetManagerEvents> {
    readonly cache: AssetCache;
    readonly manager: LoadingManager;
    private readonly models;
    private readonly base?;
    private readonly loaders;
    private readonly pending;
    private requested;
    private settled;
    constructor(options?: AssetManagerOptions, cache?: AssetCache);
    init(renderer: WebGLRenderer): void;
    extendGLTF(plugin: (parser: GLTFParser) => GLTFLoaderPlugin): this;
    register<K extends AssetKind>(kind: K, loader: AssetLoader<AssetKinds[K], AssetSource<K>>): this;
    load<K extends AssetKind>(kind: K, id: string, source: AssetSource<K>): Promise<AssetKinds[K]>;
    loadAll(manifest: AssetManifest): Promise<void>;
    get<K extends AssetKind>(kind: K, id: string): AssetKinds[K] | undefined;
    has(kind: AssetKind, id: string): boolean;
    instance(id: string): Object3D | undefined;
    release(kind: AssetKind, id: string): boolean;
    clear(...kinds: AssetKind[]): void;
    destroy(): void;
    private resolve;
    private resolveSource;
    private settle;
}
export {};
