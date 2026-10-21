import { OrbitCamera, type OrbitCameraOptions } from "./Camera";
export type DesktopCameraOptions = OrbitCameraOptions & Partial<{
    readonly button: number;
    readonly freeButton: number;
    readonly panButton: number;
}>;
export declare class DesktopCamera extends OrbitCamera {
    button: number;
    freeButton: number;
    panButton: number;
    private pointer;
    private panPointer;
    private readonly onPointerDown;
    private readonly onPointerMove;
    private readonly onPointerUp;
    private readonly onWheel;
    constructor(options?: DesktopCameraOptions);
    protected listen(element: HTMLElement | Window): void;
    protected unlisten(element: HTMLElement | Window): void;
}
//# sourceMappingURL=DesktopCamera.d.ts.map