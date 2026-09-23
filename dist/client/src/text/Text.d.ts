import { type BufferGeometry, type Camera, type ColorRepresentation, type Group, type Material, Mesh, type Scene, type WebGLRenderer } from "three";
import type { AssetLoader } from "../assets/AssetManager";
type Length = number | `${number}%`;
export interface TextProperties {
    text: string;
    font: string | null;
    fontSize: number;
    fontWeight: number | "normal" | "bold";
    fontStyle: "normal" | "italic";
    lang: string | null;
    letterSpacing: number;
    lineHeight: number | "normal";
    maxWidth: number;
    overflowWrap: "normal" | "break-word";
    textAlign: "left" | "right" | "center" | "justify";
    textIndent: number;
    whiteSpace: "normal" | "nowrap";
    direction: "auto" | "ltr" | "rtl";
    anchorX: Length | "left" | "center" | "right";
    anchorY: Length | "top" | "top-baseline" | "top-cap" | "top-ex" | "middle" | "bottom-baseline" | "bottom";
    curveRadius: number;
    unicodeFontsURL: string | null;
    color: ColorRepresentation | null;
    colorRanges: Record<number, ColorRepresentation> | null;
    fillOpacity: number;
    outlineWidth: Length;
    outlineColor: ColorRepresentation;
    outlineOpacity: number;
    outlineBlur: Length;
    outlineOffsetX: Length;
    outlineOffsetY: Length;
    strokeWidth: Length;
    strokeColor: ColorRepresentation;
    strokeOpacity: number;
    depthOffset: number;
    clipRect: [minX: number, minY: number, maxX: number, maxY: number] | null;
    orientation: string;
    glyphGeometryDetail: number;
    sdfGlyphSize: number | null;
    gpuAccelerateSDF: boolean;
    debugSDF: boolean;
}
interface TroikaTextInstance extends Mesh, TextProperties {
    sync(callback?: () => void): void;
    dispose(): void;
    hasOutline(): boolean;
}
export type TextOptions = Partial<TextProperties> & {
    readonly billboard?: boolean;
};
export type TextConfig = {
    readonly defaultFontURL?: string;
    readonly unicodeFontsURL?: string;
    readonly sdfGlyphSize?: number;
    readonly useWorker?: boolean;
};
declare const Text_base: new () => TroikaTextInstance;
export declare class Text extends Text_base {
    billboard: boolean;
    constructor(text?: string, { billboard, ...options }?: TextOptions);
    onBeforeRender(renderer: WebGLRenderer, scene: Scene, camera: Camera, geometry: BufferGeometry, material: Material, group: Group): void;
    destroy(): void;
}
export declare function preloadFont(font?: string, characters?: string | readonly string[]): Promise<void>;
declare module "../assets/AssetCache" {
    interface AssetKinds {
        font: string;
    }
}
export declare function fontLoader(characters?: string | readonly string[]): AssetLoader<string>;
export declare function configureText(config: TextConfig): void;
export {};
