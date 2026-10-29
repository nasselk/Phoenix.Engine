import type { Vector3Like } from "three";
import { ControlledCamera, type ControlledCameraOptions } from "./ControlledCamera";
export type OrbitTarget = {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};
export type OrbitCameraOptions = ControlledCameraOptions & Partial<{
    readonly yaw: number;
    readonly pitch: number;
    readonly distance: number;
    readonly minPitch: number;
    readonly maxPitch: number;
    readonly minDistance: number;
    readonly maxDistance: number;
    readonly dragging: boolean;
    readonly zooming: boolean;
}>;
export declare abstract class OrbitCamera extends ControlledCamera {
    target?: OrbitTarget;
    yaw: number;
    pitch: number;
    distance: number;
    minPitch: number;
    maxPitch: number;
    minDistance: number;
    maxDistance: number;
    dragging: boolean;
    zooming: boolean;
    protected orbiting: boolean;
    private readonly swing;
    constructor(options?: OrbitCameraOptions);
    get isOrbiting(): boolean;
    rotate(yaw: number, pitch: number): this;
    orbit(yaw: number, pitch: number): this;
    lookFrom(direction: Vector3Like, seconds?: number): this;
    zoomBy(amount: number): this;
    pinchBy(ratio: number): this;
    destroy(): this;
    protected step(seconds: number): void;
    protected drag(x: number, y: number): void;
    protected zoomByDelta(delta: number): void;
}
//# sourceMappingURL=Camera.d.ts.map