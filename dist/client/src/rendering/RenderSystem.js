import { NoToneMapping, Scene, WebGLRenderer } from "three";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { log } from "../../../shared/utils/logger";
import { waitForUserGesture } from "../utils/gesture";
import { Batcher } from "./lib/Batcher";
import { DesktopCamera } from "./lib/camera/DesktopCamera";
import { TouchCamera } from "./lib/camera/TouchCamera";
import { TextureBuilder } from "./lib/TextureBuilder";
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
        this.internals = settings.renderer === "WebGPU" ? await this.createWebGPURenderer(settings.three) : new WebGLRenderer({ powerPreference: "high-performance", ...settings.three, canvas: this.canvas });
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
        log("Renderer", `Successfully initialized the ${this.backend} renderer`);
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
    get backend() {
        if (this.internals instanceof WebGLRenderer) {
            return "WebGL";
        }
        return this.internals.backend.isWebGPUBackend ? "WebGPU" : "WebGPU (WebGL 2)";
    }
    async createWebGPURenderer(three = {}) {
        const { WebGPURenderer } = await import("three/webgpu");
        const { antialias, alpha, depth, stencil, logarithmicDepthBuffer } = three;
        const renderer = new WebGPURenderer({ canvas: this.canvas, powerPreference: "high-performance", antialias, alpha, depth, stencil, logarithmicDepthBuffer });
        const { library } = renderer;
        const lightNodeClass = library.getLightNodeClass.bind(library);
        library.getLightNodeClass = (light) => {
            for (let type = light; type !== null && type !== Function.prototype; type = Object.getPrototypeOf(type)) {
                const found = lightNodeClass(type);
                if (found !== null) {
                    return found;
                }
            }
            return null;
        };
        await renderer.init();
        return renderer;
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
        if (this.internals instanceof WebGLRenderer) {
            this.internals.forceContextLoss();
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmVuZGVyU3lzdGVtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vY2xpZW50L3NyYy9yZW5kZXJpbmcvUmVuZGVyU3lzdGVtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBNEIsYUFBYSxFQUFFLEtBQUssRUFBd0MsYUFBYSxFQUFnQyxNQUFNLE9BQU8sQ0FBQztBQUUxSixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDbEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRW5ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFeEMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzNELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN2RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUF5QnRELE1BQU0sQ0FBTixJQUFZLGlCQUtYO0FBTEQsV0FBWSxpQkFBaUI7SUFDNUIseURBQUksQ0FBQTtJQUNKLHlFQUFZLENBQUE7SUFDWix1RUFBVyxDQUFBO0lBQ1gsbUVBQVMsQ0FBQTtBQUNWLENBQUMsRUFMVyxpQkFBaUIsS0FBakIsaUJBQWlCLFFBSzVCO0FBR0QsTUFBTSxPQUFPLFlBQWEsU0FBUSxZQUFnQztJQTZCakUsWUFBbUIsS0FBaUIsRUFBRSxJQUF3QixFQUFFLEtBQUssR0FBWSxLQUFLO1FBQ3JGLEtBQUssRUFBRSxDQUFDO1FBRVIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDL0MsSUFBSSxDQUFDLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUM7UUFDMUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENB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