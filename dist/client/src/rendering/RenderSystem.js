import { Scene, WebGLRenderer } from "three";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { log } from "../../../shared/utils/logger";
import { waitForUserGesture } from "../utils/gesture";
import { DesktopCamera } from "./lib/camera/DesktopCamera";
import { TextureBuilder } from "./lib/TextureBuilder";
import { TouchCamera } from "./lib/camera/TouchCamera";
export class RenderSystem extends EventEmitter {
    constructor(view, touch = false) {
        super();
        this.view = view ?? this.createRenderingView();
        this.initialized = 0;
        this.resolution = 1;
        this.scene = new Scene();
        this.camera = touch ? new TouchCamera() : new DesktopCamera();
        this.textureBuilder = new TextureBuilder();
        this.camera.connect(this.canvas);
    }
    async init(settings = {}) {
        if (this.initialized !== 0) {
            throw new Error("Renderer is already initialized or destroyed");
        }
        this.initialized = 1;
        this.resolution = settings.resolution ?? 1;
        switch (settings.renderer) {
            case "WebGPU":
                throw new Error("WebGPU is not yet supported");
                this.three = new WebGLRenderer({
                    powerPreference: "high-performance",
                    ...settings.three,
                    canvas: this.canvas,
                });
            case "WebGL":
            default:
                this.three = new WebGLRenderer({
                    powerPreference: "high-performance",
                    ...settings.three,
                    canvas: this.canvas,
                });
        }
        this.three.setClearColor(settings.backgroundColor ?? "black");
        if (settings.fullscreen) {
            waitForUserGesture().then(() => this.setFullscreen(true));
        }
        this.initialized = 2;
        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(this.canvas);
        this.emit("init", this.canvas);
        log("Renderer", "Successfully initialized WebGL renderer");
        return this.three;
    }
    render(deltaTime, now = performance.now()) {
        if (this.initialized !== 2) {
            throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
        }
        this.emit("render", deltaTime, now);
        this.camera.update(deltaTime);
        this.three.render(this.scene, this.camera);
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
    get ready() {
        return this.initialized === 2;
    }
    resize(width, height = width) {
        if (this.initialized !== 2) {
            throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
        }
        const bounds = this.canvas.getBoundingClientRect();
        width ?? (width = bounds.width * devicePixelRatio);
        height ?? (height = bounds.height * devicePixelRatio);
        this.emit("resize", width, height);
        this.three.setSize(width * this.resolution, height * this.resolution, false);
        this.camera.fit(width / height);
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
        this.camera.destroy();
        if (view) {
            this.canvas.remove();
        }
        this.three.dispose();
        this.three.forceContextLoss();
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
        return document.fullscreenElement === this.canvas;
    }
}
