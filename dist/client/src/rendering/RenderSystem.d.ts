import { EventEmitter } from "../../../shared/utils/EventEmitter";
type RenderSystemEvents = {
    init: [renderer: HTMLCanvasElement];
    render: [deltaTime: number, now: number];
    resize: [width: number, height: number];
    load: [id: string];
    loaderror: [id: string, error: unknown];
    destroy: [];
};
type RenderAsset<A> = {
    readonly src: string;
    readonly asset: A;
};
export type RendererKind = "2D" | "3D";
export declare const enum RenderSystemState {
    NULL = 0,
    INITIALIZING = 1,
    INITIALIZED = 2,
    DESTROYED = 3
}
export declare abstract class RenderSystem<Asset = unknown> extends EventEmitter<RenderSystemEvents> {
    protected canvas: HTMLCanvasElement;
    initialized: RenderSystemState;
    resolution: number;
    protected readonly assets: Map<string, RenderAsset<Asset>>;
    private readonly loading;
    private observer?;
    protected abstract runInternalRenderer(): void;
    protected abstract loadAsset(src: string): Promise<Asset>;
    protected abstract disposeAsset(asset: Asset, src: string): void;
    constructor(view?: HTMLCanvasElement);
    load(id: string, src: string): Promise<Asset>;
    get(id: string): Asset | undefined;
    has(id: string): boolean;
    remove(id: string): void;
    init(settings: Partial<{
        resolution: number;
        fullscreen: boolean;
    }>, promise?: Promise<any>): Promise<any>;
    render(deltaTime: number, now?: number): void;
    setFullscreen(fullScreen?: boolean): Promise<this>;
    createRenderingView(width?: string, height?: string): HTMLCanvasElement;
    protected resize(width?: number, height?: number): this;
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
