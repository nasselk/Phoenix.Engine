import type { Howl } from "howler";
import type { BufferGeometry, Material, Object3D, Texture } from "three";
export interface AssetKinds {
    model: Object3D;
    texture: Texture;
    material: Material;
    geometry: BufferGeometry;
    sound: Howl;
}
export type AssetKind = Extract<keyof AssetKinds, string>;
export declare class AssetCache {
    private readonly kinds;
    private readonly disposers;
    constructor();
    setDisposer<K extends AssetKind>(kind: K, dispose: (value: AssetKinds[K]) => void): this;
    get<K extends AssetKind>(kind: K, id: string): AssetKinds[K] | undefined;
    has(kind: AssetKind, id: string): boolean;
    entries<K extends AssetKind>(kind: K): IterableIterator<[id: string, value: AssetKinds[K]]>;
    set<K extends AssetKind>(kind: K, id: string, value: AssetKinds[K]): AssetKinds[K];
    getOrCreate<K extends AssetKind>(kind: K, id: string, create: () => AssetKinds[K]): AssetKinds[K];
    release(kind: AssetKind, id: string): boolean;
    clear(...kinds: AssetKind[]): void;
    private free;
    private table;
}
