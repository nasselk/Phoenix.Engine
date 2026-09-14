import { Group } from "three";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { InfiniteGrid, type InfiniteGridOptions } from "./InfiniteGrid";
import { InfinitePlane, type InfinitePlaneOptions } from "./InfinitePlane";
import Stats from "stats.js";
export interface EditorViewOptions {
    readonly plane?: InfinitePlaneOptions;
    readonly grid?: InfiniteGridOptions;
    readonly axes?: AxisLinesOptions;
}
export declare class EditorView extends Group {
    readonly plane: InfinitePlane;
    readonly grid: InfiniteGrid;
    readonly axes: AxisLines;
    readonly pannels: {
        frames: Stats;
        memory: Stats;
        ms: Stats;
        latency: Stats.Panel;
        input: Stats.Panel;
        output: Stats.Panel;
        tps: Stats.Panel;
    };
    constructor({ plane, grid, axes }?: EditorViewOptions);
    init(stats: string): Promise<void>;
}
