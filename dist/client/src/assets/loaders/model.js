import { Mesh, Texture } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyRequestOptions } from "./request";
export class ModelLoader {
    constructor(manager, options = {}) {
        this.manager = manager;
        this.renderer = new Promise((resolve) => (this.provideRenderer = resolve));
        this.destroyed = false;
        this.gltf = new GLTFLoader(manager);
        applyRequestOptions(this.gltf, options);
        this.decoders = this.attachDecoders(options);
        this.decoders.catch(() => undefined);
    }
    init(renderer) {
        this.provideRenderer(renderer);
    }
    extend(plugin) {
        this.gltf.register(plugin);
    }
    async load(url) {
        await this.decoders;
        const gltf = await this.gltf.loadAsync(url);
        gltf.scene.animations = gltf.animations;
        return gltf.scene;
    }
    unload(model) {
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
    destroy() {
        this.destroyed = true;
        this.draco?.dispose();
        this.ktx2?.dispose();
    }
    async attachDecoders(options) {
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
