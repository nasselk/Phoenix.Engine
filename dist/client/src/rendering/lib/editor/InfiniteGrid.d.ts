import { type ColorRepresentation, Mesh, PlaneGeometry, ShaderMaterial } from "three";
export interface InfiniteGridOptions {
    readonly minorSize?: number;
    readonly majorSize?: number;
    readonly color?: ColorRepresentation;
    readonly minorOpacity?: number;
    readonly fadeDistance?: number;
    readonly fadeStrength?: number;
}
export declare class InfiniteGrid extends Mesh<PlaneGeometry, ShaderMaterial> {
    constructor({ minorSize, majorSize, color, minorOpacity, fadeDistance, fadeStrength }?: InfiniteGridOptions);
    get uniforms(): {
        [uniform: string]: import("three").IUniform<any>;
    };
}
