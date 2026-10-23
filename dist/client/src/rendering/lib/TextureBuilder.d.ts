import { Texture } from "three";
import type { AssetManager } from "../../assets/AssetManager";
export declare class TextureBuilder {
    private readonly canvas;
    private readonly context;
    private readonly assets;
    constructor(assets: AssetManager, width?: number, height?: number);
    draw(callback: (context: OffscreenCanvasRenderingContext2D) => void, clear?: boolean, width?: number, height?: number | undefined): OffscreenCanvasRenderingContext2D;
    save(name?: string): Promise<Texture>;
    download(name: string): Promise<void>;
    resize(size: number): this;
    resize(width: number, height: number): this;
    clear(): this;
    get width(): number;
    get height(): number;
}
//# sourceMappingURL=TextureBuilder.d.ts.map