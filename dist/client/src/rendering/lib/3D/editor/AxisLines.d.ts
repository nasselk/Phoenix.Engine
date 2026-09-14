import { BufferGeometry, type ColorRepresentation, LineSegments, ShaderMaterial } from "three";
export interface AxisLinesOptions {
    readonly xColor?: ColorRepresentation;
    readonly yColor?: ColorRepresentation;
    readonly zColor?: ColorRepresentation;
    readonly showY?: boolean;
    readonly fadeDistance?: number;
    readonly fadeStrength?: number;
}
export declare class AxisLines extends LineSegments<BufferGeometry, ShaderMaterial> {
    constructor({ xColor, yColor, zColor, showY, fadeDistance, fadeStrength }?: AxisLinesOptions);
    get uniforms(): {
        [uniform: string]: import("three").IUniform<any>;
    };
}
