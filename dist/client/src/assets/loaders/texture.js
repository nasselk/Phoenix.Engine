import { TextureLoader as ThreeTextureLoader } from "three";
import { applyRequestOptions } from "./request";
export class TextureLoader {
    constructor(manager, options = {}) {
        this.loader = new ThreeTextureLoader(manager);
        applyRequestOptions(this.loader, options);
    }
    load(url) {
        return this.loader.loadAsync(url);
    }
    unload(texture) {
        texture.dispose();
    }
}
