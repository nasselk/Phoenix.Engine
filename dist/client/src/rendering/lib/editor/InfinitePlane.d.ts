import { type ColorRepresentation, Mesh, PlaneGeometry, ShaderMaterial } from "three";
export interface InfinitePlaneOptions {
    readonly color?: ColorRepresentation;
    readonly opacity?: number;
    readonly height?: number;
    readonly fadeDistance?: number;
    readonly fadeStrength?: number;
}
export declare class InfinitePlane extends Mesh<PlaneGeometry, ShaderMaterial> {
    constructor({ color, opacity, height, fadeDistance, fadeStrength }?: InfinitePlaneOptions);
    get uniforms(): {
        [uniform: string]: import("three").IUniform<any>;
    };
}
