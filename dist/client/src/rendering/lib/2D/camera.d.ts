import type { Container } from "pixi.js";
export declare class Camera {
    x: number;
    y: number;
    zoom: number;
    angle: number;
    constructor(x?: number, y?: number, zoom?: number, angle?: number);
    move(x: number, y: number): this;
    transform(container: Container, width: number, height: number): this;
    revertTransform(container: Container, width: number, height: number): this;
    toWorld(screenX: number, screenY: number, width: number, height: number): {
        x: number;
        y: number;
    };
    toScreen(worldX: number, worldY: number, width: number, height: number): {
        x: number;
        y: number;
    };
}
