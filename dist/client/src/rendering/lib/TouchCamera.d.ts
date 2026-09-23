import { OrbitCamera, type OrbitCameraOptions } from "./Camera";
export type TouchCameraOptions = OrbitCameraOptions & Partial<{
    readonly pinchSpeed: number;
}>;
export declare class TouchCamera extends OrbitCamera {
    pinchSpeed: number;
    private readonly touches;
    private spread;
    private readonly onPointerDown;
    private readonly onPointerMove;
    private readonly onPointerUp;
    constructor(options?: TouchCameraOptions);
    protected listen(element: HTMLElement | Window): void;
    protected unlisten(element: HTMLElement | Window): void;
    private apart;
}
