export declare function randomInt(min: number, max: number, random?: () => number): number;
export declare function randomFloat(min?: number, max?: number, random?: () => number): number;
export declare function randomAngle(min?: number, max?: number, random?: () => number): number;
export declare function randomElement<T>(array: readonly T[]): T;
export declare function randomBoolean(w1?: number, w2?: number): boolean;
export declare function weightedRandom(...weights: number[]): number;
