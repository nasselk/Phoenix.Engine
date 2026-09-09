import { Mesh, type Object3D } from "three";
import { BoxEntity } from "../../../shared/world/entities/box";
export declare class RenderedBox extends BoxEntity {
    private readonly view;
    static view: Object3D;
    readonly mesh: Mesh;
    private drawn;
    constructor(view?: Object3D, x?: number, y?: number, z?: number, width?: number, height?: number, depth?: number, color?: number);
    onSpawn(): void;
    update(deltaTime: number): void;
    onDestroy(): void;
    draw(): void;
    static disposeMaterials(): void;
}
