export declare const enum InterpolationCurve {
    LINEAR = 0,
    EASE_IN = 1,
    EASE_OUT = 2,
    EASE_IN_OUT = 3
}
declare function lerp(start: number, end: number, factor: number, deltaTime?: number, limit?: number): number;
declare function lerpAngle(start: number, end: number, factor: number, deltaTime?: number, limit?: number): number;
declare function lerpColor(start: string, end: string, factor?: number, deltaTime?: number, limit?: number): string;
declare function clampedLerp(start: number, end: number, t: number, startT: number, endT: number): number;
declare function tween(start: number, end: number, duration: number, elapsed: number, curve?: InterpolationCurve): number;
declare function tweenAngle(start: number, end: number, duration: number, elapsed: number, curve?: InterpolationCurve): number;
declare function tweenColor(start: string, end: string, duration: number, elapsed: number, curve?: InterpolationCurve): string;
export declare const Interpolator: {
    lerp: typeof lerp;
    lerpAngle: typeof lerpAngle;
    lerpColor: typeof lerpColor;
    clampedLerp: typeof clampedLerp;
    tween: typeof tween;
    tweenAngle: typeof tweenAngle;
    tweenColor: typeof tweenColor;
};
export default Interpolator;
