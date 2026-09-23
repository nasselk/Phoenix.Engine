import type { Howl } from "howler";
import type { BufferGeometry, Material, Object3D, Texture } from "three";

/**
 * What each kind of asset is. An interface, so a module can add a kind of its own and have it typed
 * everywhere the cache and the manager take a kind.
 */
export interface AssetKinds {
	model: Object3D;
	texture: Texture;
	material: Material;
	geometry: BufferGeometry;
	sound: Howl;
}

export type AssetKind = Extract<keyof AssetKinds, string>;

/**
 * Shared resources by kind and id, freed when they are let go of: loaded models and textures, and
 * the materials and geometries code builds and reuses. Nothing here loads anything.
 *
 * Each entry has one owner — the cache — so releasing one frees it for everything that shared it.
 * Each kind says how its assets are freed: a loaded kind through its loader's `unload`, the rest
 * through `setDisposer`. A kind that never says is only forgotten.
 */
export class AssetCache {
	private readonly kinds = new Map<AssetKind, Map<string, unknown>>();

	private readonly disposers = new Map<AssetKind, (value: any) => void>();

	public constructor() {
		this.setDisposer("material", (material) => material.dispose());
		this.setDisposer("geometry", (geometry) => geometry.dispose());
	}

	/** How one kind is freed when it is released, replaced or cleared. */
	public setDisposer<K extends AssetKind>(kind: K, dispose: (value: AssetKinds[K]) => void): this {
		this.disposers.set(kind, dispose);

		return this;
	}

	public get<K extends AssetKind>(kind: K, id: string): AssetKinds[K] | undefined {
		return this.kinds.get(kind)?.get(id) as AssetKinds[K] | undefined;
	}

	public has(kind: AssetKind, id: string): boolean {
		return this.kinds.get(kind)?.has(id) === true;
	}

	/** Every asset of one kind, with its id. */
	public entries<K extends AssetKind>(kind: K): IterableIterator<[id: string, value: AssetKinds[K]]> {
		return (this.kinds.get(kind) ?? new Map<string, unknown>()).entries() as IterableIterator<[string, AssetKinds[K]]>;
	}

	/** Store an asset, freeing whatever was under that id before. */
	public set<K extends AssetKind>(kind: K, id: string, value: AssetKinds[K]): AssetKinds[K] {
		const entries = this.table(kind);
		const previous = entries.get(id);

		if (previous !== undefined && previous !== value) {
			this.free(kind, previous);
		}

		entries.set(id, value);

		return value;
	}

	/** The asset under that id, built by `create` the first time it is asked for. */
	public getOrCreate<K extends AssetKind>(kind: K, id: string, create: () => AssetKinds[K]): AssetKinds[K] {
		return this.get(kind, id) ?? this.set(kind, id, create());
	}

	/** Free an asset and forget it. Anything still drawing with it is left with released GPU resources. */
	public release(kind: AssetKind, id: string): boolean {
		const entries = this.kinds.get(kind);
		const value = entries?.get(id);

		if (entries === undefined || value === undefined) {
			return false;
		}

		entries.delete(id);
		this.free(kind, value);

		return true;
	}

	/** Free every asset of one kind, or of every kind. */
	public clear(...kinds: AssetKind[]): void {
		for (const [name, entries] of this.kinds) {
			if (kinds.length > 0 && !kinds.includes(name)) {
				continue;
			}

			for (const value of entries.values()) {
				this.free(name, value);
			}

			entries.clear();
		}
	}

	private free(kind: AssetKind, value: unknown): void {
		this.disposers.get(kind)?.(value);
	}

	private table(kind: AssetKind): Map<string, unknown> {
		let entries = this.kinds.get(kind);

		if (entries === undefined) {
			entries = new Map();

			this.kinds.set(kind, entries);
		}

		return entries;
	}
}
