import { type PerspectiveCamera, type Vector3Like } from "three";
import { ControlledCamera, type ControlledCameraOptions } from "../camera/ControlledCamera";
export type EditorCameraOptions = ControlledCameraOptions & Partial<{
    readonly flySpeed: number;
    readonly boost: number;
    readonly panSpeed: number;
    readonly minZoom: number;
    readonly maxZoom: number;
    readonly distance: number;
    readonly turnButton: number;
    readonly panButton: number;
}>;
export declare class EditorCamera extends ControlledCamera {
    flyForward: number;
    flyRight: number;
    flyBoost: boolean;
    flySpeed: number;
    boost: number;
    panSpeed: number;
    minZoom: number;
    maxZoom: number;
    distance: number;
    turnButton: number;
    panButton: number;
    private turnPointer;
    private panPointer;
    private readonly swing;
    private readonly onPointerDown;
    private readonly onPointerMove;
    private readonly onPointerUp;
    private readonly onWheel;
    constructor(options?: EditorCameraOptions);
    startFrom(camera: PerspectiveCamera): this;
    setZoom(zoom: number): this;
    orbit(yaw: number, pitch: number): this;
    lookFrom(direction: Vector3Like, seconds?: number): this;
    protected step(seconds: number): void;
    protected listen(element: HTMLElement | Window): void;
    protected unlisten(element: HTMLElement | Window): void;
    private ahead;
    private around;
    private drag;
    private pan;
}
//# sourceMappingURL=EditorCamera.d.ts.map