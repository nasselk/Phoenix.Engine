import Stats from "stats.js";
import { BufferGeometry, Group, LineBasicMaterial, LineSegments, type PerspectiveCamera } from "three";
import type { Engine } from "../../../engine";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { EditorCamera } from "./EditorCamera";
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
    readonly camera: EditorCamera;
    readonly frustum: LineSegments<BufferGeometry, LineBasicMaterial>;
    private readonly context;
    private readonly unsubscribers;
    private readonly wired;
    private wireframe;
    private flying;
    private lastFrames;
    private lastSample;
    private readonly snap;
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
    toggleCamera(attach?: boolean): void;
    get isFlying(): boolean;
    get activeCamera(): PerspectiveCamera;
    private steer;
    private key;
    private static createFrustum;
    private outline;
    viewFrom(axis: EditorAxis): void;
    orbit(x: number, y: number): void;
    private swing;
    private around;
    toggleWireframe(enabled?: boolean): void;
    private wireScene;
    destroy(): void;
}
//# sourceMappingURL=EditorView.d.ts.map