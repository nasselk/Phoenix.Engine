import { type ColorRepresentation, Scene, type ShadowMapType, type ToneMapping, WebGLRenderer, type WebGLRendererParameters } from "three";
import type { WebGPURenderer } from "three/webgpu";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import type { AssetManager } from "../assets/AssetManager";
import { Camera } from "./Camera";
import { Batcher } from "./lib/Batcher";
import { TextureBuilder } from "./lib/TextureBuilder";
type RenderSystemEvents = {
    init: [renderer: HTMLCanvasElement];
    render: [deltaTime: number, now: number];
    resize: [width: number, height: number];
    destroy: [];
};
export type RenderSystemOptions = {
    readonly renderer?: "WebGL" | "WebGPU";
    readonly resolution?: number;
    readonly fullscreen?: boolean;
    readonly backgroundColor?: ColorRepresentation;
    readonly shadows?: ShadowMapType;
    readonly toneMapping?: ToneMapping;
    readonly exposure?: number;
    readonly three?: Omit<WebGLRendererParameters, "canvas">;
};
export declare enum RenderSystemState {
    NULL = 0,
    INITIALIZING = 1,
    INITIALIZED = 2,
    DESTROYED = 3
}
export declare class RenderSystem extends EventEmitter<RenderSystemEvents> {
    protected canvas: HTMLCanvasElement;
    readonly internals: WebGLRenderer | WebGPURenderer;
    readonly scene: Scene;
    camera: Camera;
    readonly textureBuilder: TextureBuilder;
    readonly batcher: Batcher;
    initialized: RenderSystemState;
    resolution: number;
    private observer?;
    private active;
    private aspect;
    constructor(assets: AssetManager, view?: HTMLCanvasElement);
    get activeCamera(): Camera;
    set activeCamera(camera: Camera);
    init(settings?: RenderSystemOptions): Promise<WebGLRenderer | WebGPURenderer>;
    render(deltaTime: number, now?: number): void;
    setFullscreen(fullScreen?: boolean): Promise<this>;
    createRenderingView(width?: string, height?: string): HTMLCanvasElement;
    get backend(): string;
    private createWebGPURenderer;
    get ready(): boolean;
    resize(width?: number, height?: number | undefined): this;
    destroy(view?: boolean): void;
    set view(value: HTMLCanvasElement);
    get view(): HTMLCanvasElement;
    set visible(value: boolean);
    get visible(): boolean;
    set width(value: string);
    get width(): number;
    set height(value: string);
    get height(): number;
    get isFullscreen(): boolean;
}
export {};
//# sourceMappingURL=RenderSystem.d.ts.map