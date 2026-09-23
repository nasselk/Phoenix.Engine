import { LoadingManager, type Object3D, type WebGLRenderer } from "three";
import type { GLTFLoaderPlugin, GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { AssetCache, type AssetKind, type AssetKinds } from "./AssetCache";
import { ModelLoader } from "./loaders/model";
import { SoundLoader, type SoundSource } from "./loaders/sound";
import { TextureLoader } from "./loaders/texture";

/**
 * What each kind is loaded from, when that is more than a URL. Like AssetKinds, a module adds to
 * it: a sound can be several files and a sprite map. A kind not listed loads from a URL.
 */
export interface AssetSources {
	model: string;
	texture: string;
	sound: SoundSource;
}

export type AssetSource<K extends AssetKind> = K extends keyof AssetSources ? AssetSources[K] : string;

/** How one kind of asset is loaded, and freed. */
export interface AssetLoader<T, S = string> {
	/** Fetch and parse one asset from its source, with relative URLs already resolved against `path`. */
	load(source: S): Promise<T>;
	/** Free one. Left out, a released asset of this kind is only forgotten. */
	unload?(asset: T): void;
}

export type AssetManagerOptions = {
	/** What relative URLs are resolved against, like "/assets/" or a CDN. Absolute and data: URLs are left as they are. */
	readonly path?: string;
	/** Folder with three's Draco decoder files (examples/jsm/libs/draco), for Draco-compressed meshes. */
	readonly draco?: string;
	/** Folder with three's Basis transcoder files (examples/jsm/libs/basis), for KTX2 textures in models. */
	readonly ktx2?: string;
	/** Decode meshopt-compressed meshes. */
	readonly meshopt?: boolean;
	readonly crossOrigin?: string;
	/** Sent with every request, like an authorization token for a private CDN. */
	readonly headers?: Readonly<Record<string, string>>;
};

/** Assets to load, by kind, then by the id each is stored under. */
export type AssetManifest = { readonly [K in AssetKind]?: Readonly<Record<string, AssetSource<K>>> };

type AssetManagerEvents = {
	/** Assets finished so far, loaded or failed, out of every asset asked for since the last `complete`. */
	progress: [loaded: number, total: number];
	/** Everything asked for has finished, and whatever loaded is in the cache. */
	complete: [];
	load: [kind: AssetKind, id: string];
	error: [kind: AssetKind, id: string, error: unknown];
};

/**
 * Loads models, textures, sounds and any kind registered on it, and keeps each in `cache` under an id.
 * How each kind is read and freed is its loader's business, in ./loaders; this is what they share.
 *
 * A file is fetched once however often it is asked for: a loaded id resolves from the cache, and a
 * second request while the first is in flight joins it.
 *
 * `progress` and `complete` count assets, and only once each is in the cache. Three's LoadingManager
 * counts files instead, and calls a file done when it is downloaded, before it is parsed.
 */
export class AssetManager extends EventEmitter<AssetManagerEvents> {
	public readonly cache: AssetCache;

	/** Shared by three's loaders: rewrite URLs with `setURLModifier`, or follow individual files. */
	public readonly manager: LoadingManager;

	private readonly models: ModelLoader;

	private readonly base?: string;

	private readonly loaders = new Map<AssetKind, AssetLoader<unknown, any>>();

	private readonly pending = new Map<string, Promise<unknown>>();

	private requested = 0;

	private settled = 0;

	public constructor(options: AssetManagerOptions = {}, cache: AssetCache = new AssetCache()) {
		super();

		this.cache = cache;
		this.manager = new LoadingManager();
		this.base = options.path === undefined ? undefined : new URL(options.path, document.baseURI).href;

		this.models = new ModelLoader(this.manager, {
			...options,
			draco: options.draco === undefined ? undefined : this.resolve(options.draco),
			ktx2: options.ktx2 === undefined ? undefined : this.resolve(options.ktx2),
		});

		this.register("model", this.models);
		this.register("texture", new TextureLoader(this.manager, options));
		this.register("sound", new SoundLoader());
	}

	/**
	 * Hand over the WebGL renderer once it exists. KTX2 textures can only be decoded into a format the
	 * GPU supports, so with `ktx2` set, models wait for this before loading. The engine calls it.
	 */
	public init(renderer: WebGLRenderer): void {
		this.models.init(renderer);
	}

	/** Add a glTF extension, for every model loaded from now on. */
	public extendGLTF(plugin: (parser: GLTFParser) => GLTFLoaderPlugin): this {
		this.models.extend(plugin);

		return this;
	}

	/** Teach the manager a kind of asset: how to load one, and how to free one. */
	public register<K extends AssetKind>(kind: K, loader: AssetLoader<AssetKinds[K], AssetSource<K>>): this {
		this.loaders.set(kind, loader);

		if (loader.unload !== undefined) {
			this.cache.setDisposer(kind, (asset) => loader.unload?.(asset));
		}

		return this;
	}

	/** Load an asset under an id, or get it from the cache if that id is already there. */
	public load<K extends AssetKind>(kind: K, id: string, source: AssetSource<K>): Promise<AssetKinds[K]> {
		const cached = this.cache.get(kind, id);

		if (cached !== undefined) {
			return Promise.resolve(cached);
		}

		const key = `${kind}:${id}`;
		const pending = this.pending.get(key);

		if (pending !== undefined) {
			return pending as Promise<AssetKinds[K]>;
		}

		const loader = this.loaders.get(kind);

		if (loader === undefined) {
			return Promise.reject(new Error(`No loader is registered for "${kind}" assets`));
		}

		const promise = loader.load(this.resolveSource(source)).then(
			(value) => {
				// Gone from `pending` only if it was cleared or destroyed meanwhile: nobody is left to own it.
				if (!this.pending.delete(key)) {
					loader.unload?.(value);

					return value as AssetKinds[K];
				}

				this.cache.set(kind, id, value as AssetKinds[K]);

				this.emit("load", kind, id);
				this.settle();

				return value as AssetKinds[K];
			},
			(error: unknown) => {
				if (this.pending.delete(key)) {
					this.emit("error", kind, id, error);
					this.settle();
				}

				throw error;
			},
		);

		this.pending.set(key, promise);
		this.requested++;

		this.emit("progress", this.settled, this.requested);

		return promise;
	}

	/** Load everything in a manifest; resolves once all of it has loaded. */
	public async loadAll(manifest: AssetManifest): Promise<void> {
		const loads: Promise<unknown>[] = [];

		for (const kind of Object.keys(manifest) as AssetKind[]) {
			for (const [id, source] of Object.entries(manifest[kind] ?? {})) {
				loads.push(this.load(kind, id, source as AssetSource<typeof kind>));
			}
		}

		await Promise.all(loads);
	}

	/** The shared, cached asset. To put a model in the scene, use `instance` instead. */
	public get<K extends AssetKind>(kind: K, id: string): AssetKinds[K] | undefined {
		return this.cache.get(kind, id);
	}

	public has(kind: AssetKind, id: string): boolean {
		return this.cache.has(kind, id);
	}

	/**
	 * A copy of a loaded model to add to the scene. An object can only have one parent, so the cached
	 * model is never added itself. Copies share its geometries and materials, and skinned meshes get
	 * their own skeleton.
	 */
	public instance(id: string): Object3D | undefined {
		const model = this.cache.get("model", id);

		return model === undefined ? undefined : clone(model);
	}

	/** Free an asset and forget it. Copies of a released model lose their GPU resources with it. */
	public release(kind: AssetKind, id: string): boolean {
		return this.cache.release(kind, id);
	}

	public clear(...kinds: AssetKind[]): void {
		this.cache.clear(...kinds);

		for (const key of this.pending.keys()) {
			const [kind] = key.split(":");

			if (kinds.length > 0 && !kinds.includes(kind as AssetKind)) {
				continue;
			}

			this.pending.delete(key);
		}
	}

	public destroy(): void {
		this.models.destroy();

		this.pending.clear();
		this.requested = 0;
		this.settled = 0;
		this.cache.clear();

		this.removeAllListeners();
	}

	private resolve(url: string): string {
		return this.base === undefined ? url : new URL(url, this.base).href;
	}

	/** A URL, or the URLs in a source's `src`, resolved against `path`. Anything else is left as it is. */
	private resolveSource<S>(source: S): S {
		if (this.base === undefined) {
			return source;
		}

		if (typeof source === "string") {
			return this.resolve(source) as S;
		}

		if (typeof source === "object" && source !== null && "src" in source) {
			const { src } = source as { readonly src: string | readonly string[] };

			return { ...source, src: typeof src === "string" ? this.resolve(src) : src.map((url) => this.resolve(url)) };
		}

		return source;
	}

	private settle(): void {
		this.settled++;

		this.emit("progress", this.settled, this.requested);

		if (this.pending.size === 0) {
			this.requested = 0;
			this.settled = 0;

			this.emit("complete");
		}
	}
}
