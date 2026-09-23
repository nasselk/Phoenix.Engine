import { type LoadingManager, type Texture, TextureLoader as ThreeTextureLoader } from "three";
import type { AssetLoader } from "../AssetManager";
import { applyRequestOptions, type RequestOptions } from "./request";

export class TextureLoader implements AssetLoader<Texture> {
	private readonly loader: ThreeTextureLoader;

	public constructor(manager: LoadingManager, options: RequestOptions = {}) {
		this.loader = new ThreeTextureLoader(manager);

		applyRequestOptions(this.loader, options);
	}

	public load(url: string): Promise<Texture> {
		return this.loader.loadAsync(url);
	}

	/** Frees the GPU copy. The image stays in memory for as long as something still holds it. */
	public unload(texture: Texture): void {
		texture.dispose();
	}
}
