import Stats from "stats.js";
import { BufferGeometry, Group, LineBasicMaterial, LineSegments } from "three";
import type { Engine } from "../../../engine";
import { Camera } from "../camera/Camera";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { InfiniteGrid, type InfiniteGridOptions } from "./InfiniteGrid";
import { InfinitePlane, type InfinitePlaneOptions } from "./InfinitePlane";
export type EditorAxis = "x" | "y" | "z" | "-x" | "-y" | "-z";
export interface EditorViewOptions {
    readonly plane?: InfinitePlaneOptions;
    readonly grid?: InfiniteGridOptions;
    readonly axes?: AxisLinesOptions;
}
export declare class EditorView extends Group {
    readonly plane: InfinitePlane;
    readonly grid: InfiniteGrid;
    readonly axes: AxisLines;
    readonly camera: Camera;
    readonly frustum: LineSegments<BufferGeometry, LineBasicMaterial>;
    private readonly context;
    private readonly unsubscribers;
    private readonly wired;
    private wireframe;
    private statsShown;
    private shadows;
    private readonly shadowless;
    private lastFrames;
    private lastSample;
    readonly stats: {
        frames: Stats;
        memory: Stats;
        ms: Stats;
        latency: Stats.Panel;
        input: Stats.Panel;
        output: Stats.Panel;
        tps: Stats.Panel;
    };
    constructor(engine: Engine<any, any, any, any, any, any, any>, { plane, grid, axes }?: EditorViewOptions);
    init(stats: string): Promise<void>;
    fly(enabled?: boolean): void;
    get isFlying(): boolean;
    get activeCamera(): Camera;
    private steer;
    private key;
    private static createCamera;
    private static createFrustum;
    private outline;
    viewFrom(axis: EditorAxis): void;
    orbit(x: number, y: number): void;
    toggleShadows(enabled?: boolean): void;
    toggleGrid(enabled?: boolean): void;
    toggleStats(enabled?: boolean): void;
    toggleWireframe(enabled?: boolean): void;
    private wireScene;
    destroy(): void;
}
//# sourceMappingURL=EditorView.d.ts.map