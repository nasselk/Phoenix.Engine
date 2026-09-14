import { Group } from "three";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { InfiniteGrid, type InfiniteGridOptions } from "./InfiniteGrid";
import { InfinitePlane, type InfinitePlaneOptions } from "./InfinitePlane";
export interface EditViewOptions {
    plane?: InfinitePlaneOptions;
    grid?: InfiniteGridOptions;
    axes?: AxisLinesOptions;
}
export declare class EditView extends Group {
    readonly plane: InfinitePlane;
    readonly grid: InfiniteGrid;
    readonly axes: AxisLines;
    constructor({ plane, grid, axes }?: EditViewOptions);
}
