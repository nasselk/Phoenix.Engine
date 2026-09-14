import { Group } from "three";
import { AxisLines } from "./AxisLines";
import { InfiniteGrid } from "./InfiniteGrid";
import { InfinitePlane } from "./InfinitePlane";
export class EditView extends Group {
    constructor({ plane, grid, axes } = {}) {
        super();
        this.plane = new InfinitePlane(plane);
        this.grid = new InfiniteGrid(grid);
        this.axes = new AxisLines(axes);
        this.add(this.plane, this.grid, this.axes);
    }
}
