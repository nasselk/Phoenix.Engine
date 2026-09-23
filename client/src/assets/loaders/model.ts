import { type LoadingManager, Mesh, type Object3D, Texture, type WebGLRenderer } from "three";
import type { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTFLoaderPlugin, type GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import type { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import type { AssetLoader } from "../AssetManager";
import { applyRequestOptions, type RequestOptions } from "./request";

export type ModelLoaderOptions = RequestOptions & {
	/** Folder with three's Draco decoder files, already resolved. */
	readonly draco?: string;
	/** Folder with three's Basis transcoder files, already resolved. */
	readonly ktx2?: string;
	readonly meshopt?: boolean;
};

/** glTF and GLB models, with whichever of the Draco, KTX2 and meshopt decoders the options ask for. */
export class ModelLoader implements AssetLoader<Object3D> {
	private readonly gltf: GLTFLoader;

	private draco?: DRACOLoader;

	private ktx2?: KTX2Loader;

	/** Settles once every decoder the options ask for is loaded and attached; models wait on it. */
	private readonly decoders: Promise<void>;

	private provideRenderer!: (renderer: WebGLRenderer) => void;

	private readonly renderer = new Promise<WebGLRenderer>((resolve) => (this.provideRenderer = resolve));

	private destroyed = false;

	public constructor(
		private readonly manager: LoadingManager,
		options: ModelLoaderOptions = {},
	) {
		this.gltf = new GLTFLoader(manager);

		applyRequestOptions(this.gltf, options);

		this.decoders = this.attachDecoders(options);
		// A decoder that fails to load fails the models that wait on it, not the page with an unhandled rejection.
		this.decoders.catch(() => undefined);
	}

	/** KTX2 textures can only be decoded into a format the GPU supports, so with `ktx2` set, models wait for this. */
	public init(renderer: WebGLRenderer): void {
		this.provideRenderer(renderer);
	}

	public extend(plugin: (parser: GLTFParser) => GLTFLoaderPlugin): void {
		this.gltf.register(plugin);
	}

	public async load(url: string): Promise<Object3D> {
		await this.decoders;

		const gltf = await this.gltf.loadAsync(url);

		// Kept on the scene, which is what gets cached and cloned, rather than lost with the wrapper.
		gltf.scene.animations = gltf.animations;

		return gltf.scene;
	}

	/**
	 * Three frees no GPU memory on its own, so the model is walked: its geometries, its materials
	 * and the textures those materials hold are all freed.
	 */
	public unload(model: Object3D): void {
		model.removeFromParent();

		model.traverse((child) => {
			if (!(child instanceof Mesh)) {
				return;
			}

			child.geometry.dispose();

			for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
				for (const property of Object.values(material)) {
					if (property instanceof Texture) {
						property.dispose();
					}
				}

				material.dispose();
			}
		});
	}

	public destroy(): void {
		this.destroyed = true;
		this.draco?.dispose();
		this.ktx2?.dispose();
	}

	/**
	 * The decoders are imported only when asked for, so a game that uses none of them bundles none of
	 * their code or workers.
	 */
	private async attachDecoders(options: ModelLoaderOptions): Promise<void> {
		const [draco, ktx2, meshopt] = await Promise.all([
			options.draco === undefined ? undefined : import("three/addons/loaders/DRACOLoader.js"),
			options.ktx2 === undefined ? undefined : Promise.all([import("three/addons/loaders/KTX2Loader.js"), this.renderer]),
			options.meshopt === true ? import("three/addons/libs/meshopt_decoder.module.js") : undefined,
		]);

		if (this.destroyed) {
			return;
		}

		if (draco !== undefined && options.draco !== undefined) {
			this.draco = new draco.DRACOLoader(this.manager).setDecoderPath(options.draco);
			this.gltf.setDRACOLoader(this.draco);
		}

		if (ktx2 !== undefined && options.ktx2 !== undefined) {
			const [{ KTX2Loader }, renderer] = ktx2;

			this.ktx2 = new KTX2Loader(this.manager).setTranscoderPath(options.ktx2).detectSupport(renderer);
			this.gltf.setKTX2Loader(this.ktx2);
		}

		if (meshopt !== undefined) {
			this.gltf.setMeshoptDecoder(meshopt.MeshoptDecoder);
		}
	}
}
