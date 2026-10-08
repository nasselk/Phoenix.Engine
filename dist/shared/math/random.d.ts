export declare function randomInt(min: number, max: number, random?: () => number): number;
export declare function randomFloat(min?: number, max?: number, random?: () => number): number;
export declare function randomAngle(min?: number, max?: number, random?: () => number): number;
export declare function randomElement<T>(array: readonly T[], random?: () => number): T;
export declare function randomBoolean(w1?: number, w2?: number, random?: () => number): boolean;
export declare function weightedRandom(weights: readonly number[], random?: () => number): number;
