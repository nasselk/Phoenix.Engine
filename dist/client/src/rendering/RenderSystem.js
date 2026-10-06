import { NoToneMapping, Scene, WebGLRenderer } from "three";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { log } from "../../../shared/utils/logger";
import { waitForUserGesture } from "../utils/gesture";
import { DesktopCamera } from "./lib/camera/DesktopCamera";
import { TextureBuilder } from "./lib/TextureBuilder";
import { Batcher } from "./lib/Batcher";
import { TouchCamera } from "./lib/camera/TouchCamera";
export var RenderSystemState;
(function (RenderSystemState) {
    RenderSystemState[RenderSystemState["NULL"] = 0] = "NULL";
    RenderSystemState[RenderSystemState["INITIALIZING"] = 1] = "INITIALIZING";
    RenderSystemState[RenderSystemState["INITIALIZED"] = 2] = "INITIALIZED";
    RenderSystemState[RenderSystemState["DESTROYED"] = 3] = "DESTROYED";
})(RenderSystemState || (RenderSystemState = {}));
export class RenderSystem extends EventEmitter {
    constructor(cache, view, touch = false) {
        super();
        this.view = view ?? this.createRenderingView();
        this.initialized = RenderSystemState.NULL;
        this.resolution = 1;
        this.scene = new Scene();
        this.camera = touch ? new TouchCamera() : new DesktopCamera();
        this.textureBuilder = new TextureBuilder(cache);
        this.batcher = new Batcher();
        this.camera.connect(this.canvas);
    }
    async init(settings = {}) {
        if (this.initialized !== RenderSystemState.NULL) {
            throw new Error("Renderer is already initialized or destroyed");
        }
        this.initialized = RenderSystemState.INITIALIZING;
        this.resolution = settings.resolution ?? 1;
        switch (settings.renderer) {
            case "WebGPU":
                throw new Error("WebGPU is not yet supported");
                this.internals = new WebGLRenderer({
                    powerPreference: "high-performance",
                    ...settings.three,
                    canvas: this.canvas,
                });
            case "WebGL":
            default:
                this.internals = new WebGLRenderer({
                    powerPreference: "high-performance",
                    ...settings.three,
                    canvas: this.canvas,
                });
        }
        this.internals.setClearColor(settings.backgroundColor ?? "black");
        this.internals.shadowMap.enabled = settings.shadows !== undefined;
        this.internals.shadowMap.type = settings.shadows ?? this.internals.shadowMap.type;
        this.internals.toneMapping = settings.toneMapping ?? NoToneMapping;
        this.internals.toneMappingExposure = settings.exposure ?? 1;
        if (settings.fullscreen) {
            this.setFullscreen(settings.fullscreen);
        }
        this.initialized = RenderSystemState.INITIALIZED;
        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(this.canvas);
        this.emit("init", this.canvas);
        log("Renderer", "Successfully initialized WebGL renderer");
        return this.internals;
    }
    render(deltaTime, now = performance.now()) {
        if (this.initialized !== RenderSystemState.INITIALIZED) {
            throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
        }
        this.emit("render", deltaTime, now);
        this.camera.update(deltaTime);
        this.internals.render(this.scene, this.camera);
    }
    async setFullscreen(fullScreen = !this.isFullscreen) {
        if (fullScreen === this.isFullscreen) {
            return this;
        }
        await waitForUserGesture();
        if (fullScreen === this.isFullscreen) {
            return this;
        }
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
    get ready() {
        return this.initialized === RenderSystemState.INITIALIZED;
    }
    resize(width, height = width) {
        if (this.initialized !== RenderSystemState.INITIALIZED) {
            throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
        }
        const bounds = this.canvas.getBoundingClientRect();
        width ?? (width = bounds.width * devicePixelRatio);
        height ?? (height = bounds.height * devicePixelRatio);
        this.emit("resize", width, height);
        this.internals.setSize(width * this.resolution, height * this.resolution, false);
        this.camera.fit(width / height);
        return this;
    }
    destroy(view = false) {
        if (this.initialized === RenderSystemState.NULL) {
            throw new Error("Renderer is not initialized");
        }
        if (this.initialized === RenderSystemState.DESTROYED) {
            throw new Error("Renderer is already destroyed");
        }
        this.observer?.disconnect();
        this.camera.destroy();
        this.batcher.destroy();
        if (view) {
            this.canvas.remove();
        }
        this.internals.dispose();
        this.internals.forceContextLoss();
        this.initialized = RenderSystemState.DESTROYED;
        this.emit("destroy");
        this.removeAllListeners();
    }
    set view(value) {
        if (value !== this.canvas) {
            this.canvas = value;
            this.observer?.disconnect();
            this.observer?.observe(value);
            if (this.camera !== undefined) {
                this.camera.connect(value);
            }
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
        return document.fullscreenElement !== null;
    }
}
