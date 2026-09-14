import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { waitForUserGesture } from "../utils/gesture";
export class RenderSystem extends EventEmitter {
    constructor(view) {
        super();
        this.view = view ?? this.createRenderingView();
        this.initialized = 0;
        this.resolution = 1;
        this.assets = new Map();
        this.loading = new Map();
    }
    load(id, src) {
        const loaded = this.assets.get(id);
        if (loaded !== undefined) {
            return Promise.resolve(loaded.asset);
        }
        const pending = this.loading.get(id);
        if (pending !== undefined) {
            return pending;
        }
        const promise = this.loadAsset(src)
            .then((asset) => {
            this.loading.delete(id);
            this.assets.set(id, { src, asset });
            this.emit("load", id);
            return asset;
        })
            .catch((error) => {
            this.loading.delete(id);
            this.emit("loaderror", id, error);
            throw error;
        });
        this.loading.set(id, promise);
        return promise;
    }
    get(id) {
        return this.assets.get(id)?.asset;
    }
    has(id) {
        return this.assets.has(id);
    }
    remove(id) {
        const entry = this.assets.get(id);
        if (entry === undefined) {
            return;
        }
        this.assets.delete(id);
        this.disposeAsset(entry.asset, entry.src);
    }
    async init(settings, promise) {
        if (this.initialized !== 0) {
            throw new Error("Renderer is already initialized or destroyed");
        }
        this.initialized = 1;
        this.resolution = settings.resolution ?? 1;
        if (settings.fullscreen) {
            waitForUserGesture().then(() => this.setFullscreen(true));
        }
        await promise;
        this.initialized = 2;
        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(this.canvas);
        this.emit("init", this.canvas);
    }
    render(deltaTime, now = performance.now()) {
        if (this.initialized !== 2) {
            throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
        }
        this.emit("render", deltaTime, now);
        this.runInternalRenderer();
    }
    async setFullscreen(fullScreen = !this.isFullscreen) {
        if (fullScreen) {
            await document.documentElement.requestFullscreen();
        }
        else {
            await document.exitFullscreen();
        }
        return this;
    }
    createRenderingView(width = "100%", height = "100%") {
        const canvas = document.createElement("canvas");
        canvas.id = "engine-canvas";
        canvas.style.position = "fixed";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.width = width;
        canvas.style.height = height;
        canvas.style.zIndex;
        return canvas;
    }
    resize(width = 0, height = width) {
        if (this.initialized !== 2) {
            throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
        }
        this.emit("resize", width, height);
        return this;
    }
    destroy(view = false) {
        if (this.initialized === 0) {
            throw new Error("Renderer is not initialized");
        }
        if (this.initialized === 3) {
            throw new Error("Renderer is already destroyed");
        }
        this.observer?.disconnect();
        if (view) {
            this.canvas.remove();
        }
        for (const id of [...this.assets.keys()]) {
            this.remove(id);
        }
        this.loading.clear();
        this.emit("destroy");
        this.removeAllListeners();
    }
    set view(value) {
        if (value !== this.canvas) {
            this.canvas = value;
            this.observer?.disconnect();
            this.observer?.observe(value);
        }
    }
    get view() {
        return this.canvas;
    }
    set visible(value) {
        this.canvas.style.display = value ? "block" : "none";
    }
    get visible() {
        return this.canvas.style.display !== "none";
    }
    set width(value) {
        this.canvas.style.width = value;
    }
    get width() {
        const bounds = this.canvas.getBoundingClientRect();
        return bounds.width;
    }
    set height(value) {
        this.canvas.style.height = value;
    }
    get height() {
        const bounds = this.canvas.getBoundingClientRect();
        return bounds.height;
    }
    get isFullscreen() {
        return document.fullscreenElement === this.canvas;
    }
}
