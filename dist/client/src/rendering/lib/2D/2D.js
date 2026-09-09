import { Assets, autoDetectRenderer, RendererType } from "pixi.js";
import { DefaultContainer } from "./createVisuals";
import { log } from "../../../../../shared/utils/logger";
import { RenderSystem } from "../../RenderSystem";
import { Camera } from "./camera";
export class PixiRenderer extends RenderSystem {
    constructor(view, stage = new DefaultContainer()) {
        super(view);
        this.camera = new Camera();
        this.scene = stage;
        this.world = new DefaultContainer({ isRenderGroup: true });
        this.scene.addChild(this.world);
    }
    async init(settings) {
        const promise = autoDetectRenderer({
            powerPreference: "high-performance",
            backgroundColor: settings.backgroundColor,
            preference: settings.renderer,
            antialias: settings.antialiasing,
            eventMode: import.meta.env.PROD ? "none" : "passive",
            canvas: this.canvas,
            roundPixels: false,
        });
        promise.then((renderer) => {
            this.pixi = renderer;
            log("Renderer", `Successfully initialized ${RendererType[this.pixi.type]} renderer`);
        });
        await super.init(settings, promise);
        return this.pixi;
    }
    runInternalRenderer() {
        this.pixi.render(this.scene);
    }
    async loadAsset(src) {
        return Assets.load(src);
    }
    disposeAsset(_asset, src) {
        void Assets.unload(src);
    }
    resize(width, height = width) {
        const bounds = this.canvas.getBoundingClientRect();
        if (width === undefined) {
            width = bounds.width * devicePixelRatio;
        }
        if (height === undefined) {
            height = bounds.height * devicePixelRatio;
        }
        super.resize(width, height);
        this.pixi.resize(width * this.resolution, height * this.resolution);
        return this;
    }
    destroy(view) {
        super.destroy(view);
        this.pixi.destroy();
    }
}
