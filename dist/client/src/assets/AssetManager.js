import { LoadingManager, Material, Object3D, Texture } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { AssetCache } from "./AssetCache";
import { ModelLoader } from "./loaders/model";
import { SoundLoader } from "./loaders/sound";
import { TextureLoader } from "./loaders/texture";
export class AssetManager extends EventEmitter {
    constructor(options = {}, cache = new AssetCache()) {
        super();
        this.loaders = new Map();
        this.pending = new Map();
        this.requested = 0;
        this.settled = 0;
        this.requestedAnisotropy = 1;
        this.supportedAnisotropy = 1;
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
    init(renderer) {
        this.models.init(renderer);
        this.supportedAnisotropy = Math.max(1, "capabilities" in renderer ? renderer.capabilities.getMaxAnisotropy() : renderer.getMaxAnisotropy());
        this.applyAnisotropyToCache();
    }
    get maxAnisotropy() {
        return this.supportedAnisotropy;
    }
    get anisotropy() {
        return Math.min(this.requestedAnisotropy, this.supportedAnisotropy);
    }
    set anisotropy(value) {
        this.requestedAnisotropy = Math.max(1, value);
        this.applyAnisotropyToCache();
    }
    applyAnisotropy(asset) {
        const anisotropy = this.anisotropy;
        if (asset instanceof Texture) {
            setAnisotropy(asset, anisotropy);
        }
        else if (asset instanceof Material) {
            setMaterialAnisotropy(asset, anisotropy);
        }
        else {
            asset.traverse((child) => {
                if ("material" in child && child.material !== undefined) {
                    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
                        if (material instanceof Material) {
                            setMaterialAnisotropy(material, anisotropy);
                        }
                    }
                }
            });
        }
    }
    extendGLTF(plugin) {
        this.models.extend(plugin);
        return this;
    }
    register(kind, loader) {
        this.loaders.set(kind, loader);
        if (loader.unload !== undefined) {
            this.cache.setDisposer(kind, (asset) => loader.unload?.(asset));
        }
        return this;
    }
    load(kind, id, source) {
        const cached = this.cache.get(kind, id);
        if (cached !== undefined) {
            return Promise.resolve(cached);
        }
        const key = `${kind}:${id}`;
        const pending = this.pending.get(key);
        if (pending !== undefined) {
            return pending;
        }
        const loader = this.loaders.get(kind);
        if (loader === undefined) {
            return Promise.reject(new Error(`No loader is registered for "${kind}" assets`));
        }
        const promise = loader.load(this.resolveSource(source)).then((value) => {
            if (!this.pending.delete(key)) {
                loader.unload?.(value);
                return value;
            }
            if (value instanceof Texture || value instanceof Material || value instanceof Object3D) {
                this.applyAnisotropy(value);
            }
            this.cache.set(kind, id, value);
            this.emit("load", kind, id);
            this.settle();
            return value;
        }, (error) => {
            if (this.pending.delete(key)) {
                this.emit("error", kind, id, error);
                this.settle();
            }
            throw error;
        });
        this.pending.set(key, promise);
        this.requested++;
        this.emit("progress", this.settled, this.requested);
        return promise;
    }
    async loadAll(manifest) {
        const loads = [];
        for (const kind of Object.keys(manifest)) {
            for (const [id, source] of Object.entries(manifest[kind] ?? {})) {
                loads.push(this.load(kind, id, source));
            }
        }
        await Promise.all(loads);
    }
    get(kind, id) {
        return this.cache.get(kind, id);
    }
    has(kind, id) {
        return this.cache.has(kind, id);
    }
    instance(id) {
        const model = this.cache.get("model", id);
        return model === undefined ? undefined : clone(model);
    }
    release(kind, id) {
        return this.cache.release(kind, id);
    }
    clear(...kinds) {
        this.cache.clear(...kinds);
        for (const key of this.pending.keys()) {
            const [kind] = key.split(":");
            if (kinds.length > 0 && !kinds.includes(kind)) {
                continue;
            }
            this.pending.delete(key);
        }
    }
    destroy() {
        this.models.destroy();
        this.pending.clear();
        this.requested = 0;
        this.settled = 0;
        this.cache.clear();
        this.removeAllListeners();
    }
    resolve(url) {
        return this.base === undefined ? url : new URL(url, this.base).href;
    }
    resolveSource(source) {
        if (this.base === undefined) {
            return source;
        }
        if (typeof source === "string") {
            return this.resolve(source);
        }
        if (typeof source === "object" && source !== null && "src" in source) {
            const { src } = source;
            return { ...source, src: typeof src === "string" ? this.resolve(src) : src.map((url) => this.resolve(url)) };
        }
        return source;
    }
    applyAnisotropyToCache() {
        for (const kind of ["texture", "material", "model"]) {
            for (const asset of this.cache.values(kind)) {
                this.applyAnisotropy(asset);
            }
        }
    }
    settle() {
        this.settled++;
        this.emit("progress", this.settled, this.requested);
        if (this.pending.size === 0) {
            this.requested = 0;
            this.settled = 0;
            this.emit("complete");
        }
    }
}
function setMaterialAnisotropy(material, anisotropy) {
    for (const property of Object.values(material)) {
        if (property instanceof Texture) {
            setAnisotropy(property, anisotropy);
        }
    }
}
function setAnisotropy(texture, anisotropy) {
    if (texture.anisotropy === anisotropy || texture.isRenderTargetTexture) {
        return;
    }
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
}
//# sourceMappingURL=AssetManager.js.map