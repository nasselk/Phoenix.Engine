import { Container, RendererPreference, type Renderer, type Texture } from "pixi.js";
import { RenderSystem } from "../../RenderSystem";
import { Camera } from "./camera";
type RendererSettings = Partial<{
    resolution: number;
    renderer: RendererPreference | RendererPreference[];
    backgroundColor: number;
    antialiasing: boolean;
    fullscreen: boolean;
}>;
export declare class PixiRenderer extends RenderSystem<Texture> {
    private pixi;
    world: Container;
    scene: Container;
    camera: Camera;
    constructor(view?: HTMLCanvasElement, stage?: Container);
    init(settings: RendererSettings): Promise<Renderer>;
    protected runInternalRenderer(): void;
    protected loadAsset(src: string): Promise<Texture>;
    protected disposeAsset(_asset: Texture, src: string): void;
    protected resize(width?: number, height?: number | undefined): this;
    destroy(view?: boolean): void;
}
export {};
