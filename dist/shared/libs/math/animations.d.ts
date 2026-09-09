export declare function wave(min: number, max: number, speed?: number, now?: number): number;
export declare function syncedWave(min: number, max: number, index: number, maxIndex: number, speed?: number, now?: number, allowNegative?: boolean): number;
export declare function pointsSyncedWave(start: number, middle: number, end: number): (t: number) => number;
export declare function fadeInHoldAndFadeOut(time: number, fadeInTime: number, fadeOutTime: number, totalTime?: number, min?: number, max?: number): number;
