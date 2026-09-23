import { OrbitCamera, type OrbitCameraOptions } from "./Camera";
export type FlyKeys = {
    readonly forward: readonly string[];
    readonly back: readonly string[];
    readonly left: readonly string[];
    readonly right: readonly string[];
    readonly boost: readonly string[];
};
export type DesktopCameraOptions = OrbitCameraOptions & Partial<{
    readonly button: number;
    readonly flySpeed: number;
    readonly boost: number;
    readonly keys: Partial<FlyKeys>;
}>;
export declare class DesktopCamera extends OrbitCamera {
    button: number;
    flySpeed: number;
    boost: number;
    readonly keys: FlyKeys;
    private pointer;
    private readonly held;
    private readonly forward;
    private readonly right;
    private readonly step;
    private readonly onPointerDown;
    private readonly onPointerMove;
    private readonly onPointerUp;
    private readonly onWheel;
    private readonly onKeyDown;
    private readonly onKeyUp;
    private readonly onBlur;
    constructor(options?: DesktopCameraOptions);
    protected listen(element: HTMLElement | Window): void;
    protected unlisten(element: HTMLElement | Window): void;
    protected onDetached(_detached: boolean): void;
    protected fly(seconds: number): void;
    private pressed;
}
