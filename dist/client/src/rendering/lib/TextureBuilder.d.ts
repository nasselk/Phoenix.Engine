import { CanvasTexture } from "three";
export declare class TextureBuilder {
    private readonly canvas;
    private readonly context;
    constructor(width?: number, height?: number);
    draw(callback: (context: OffscreenCanvasRenderingContext2D) => void, reset?: boolean): OffscreenCanvasRenderingContext2D;
    save(name?: string): CanvasTexture<OffscreenCanvas>;
    download(name: string): Promise<void>;
    resize(width: number, height: number): this;
    clear(): this;
    get width(): number;
    get height(): number;
}
