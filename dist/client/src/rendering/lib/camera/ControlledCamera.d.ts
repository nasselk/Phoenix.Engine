import { PerspectiveCamera, type Vector3Like } from "three";
export type ControlledCameraOptions = Partial<{
    readonly fov: number;
    readonly minHorizontalFov: number;
    readonly near: number;
    readonly far: number;
    readonly rotateSpeed: number;
    readonly turnSpeed: number;
    readonly tiltSpeed: number;
    readonly zoomSpeed: number;
}>;
export declare abstract class ControlledCamera extends PerspectiveCamera {
    turn: number;
    tilt: number;
    rotateSpeed: number;
    turnSpeed: number;
    tiltSpeed: number;
    zoomSpeed: number;
    protected element?: HTMLElement | Window;
    private verticalFovDegrees;
    private minHorizontalFovDegrees;
    constructor(options?: ControlledCameraOptions);
    fit(aspect?: number): this;
    get verticalFov(): number;
    set verticalFov(degrees: number);
    get minHorizontalFov(): number;
    set minHorizontalFov(degrees: number);
    connect(element?: HTMLElement | Window): this;
    destroy(): this;
    update(deltaTime?: number): this;
    abstract orbit(yaw: number, pitch: number): this;
    abstract lookFrom(direction: Vector3Like, seconds?: number): this;
    protected abstract step(seconds: number): void;
    protected abstract listen(element: HTMLElement | Window): void;
    protected abstract unlisten(element: HTMLElement | Window): void;
}
export declare function ease(progress: number): number;
//# sourceMappingURL=ControlledCamera.d.ts.map