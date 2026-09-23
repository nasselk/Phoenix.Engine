import { Group } from "three";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { InfiniteGrid, type InfiniteGridOptions } from "./InfiniteGrid";
import { InfinitePlane, type InfinitePlaneOptions } from "./InfinitePlane";
import Stats from "stats.js";
import type { Engine } from "../../../engine";
export interface EditorViewOptions {
    readonly plane?: InfinitePlaneOptions;
    readonly grid?: InfiniteGridOptions;
    readonly axes?: AxisLinesOptions;
}
export declare class EditorView extends Group {
    readonly plane: InfinitePlane;
    readonly grid: InfiniteGrid;
    readonly axes: AxisLines;
    private readonly context;
    private readonly unsubscribers;
    private readonly wired;
    private wireframe;
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
    toggleWireframe(enabled?: boolean): void;
    private wireScene;
    destroy(): void;
}
