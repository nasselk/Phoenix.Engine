import { Vector } from "./vector.js";
export declare function randomBoolean(w1?: number, w2?: number): boolean;
export declare function randomInt(min: number, max: number, random?: () => number): number;
export declare function randomFloat(min?: number, max?: number, random?: () => number): number;
export declare function randomElement<T>(array: readonly T[]): T;
export declare function weightedRandom(...weights: number[]): number;
export declare function randomCirclePoint(position: Vector, radius: number, innerRadius?: number, random?: () => number): Vector;
export declare function randomTrianglePoint(p1: Vector, p2: Vector, p3: Vector, random?: () => number): Vector;
