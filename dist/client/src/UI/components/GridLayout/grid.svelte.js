import { getContext, setContext, untrack } from "svelte";
export const GRID_DEFAULTS = {
    top_left: { direction: "column", z: 1 },
    top_center: { direction: "row", z: 3 },
    top_right: { direction: "column", z: 1 },
    middle_left: { direction: "column", z: 2 },
    middle_center: { direction: "row", z: 4 },
    middle_right: { direction: "column", z: 2 },
    bottom_left: { direction: "column", z: 3 },
    bottom_center: { direction: "row", z: 2 },
    bottom_right: { direction: "column", z: 3 },
};
export const GRID_POSITIONS = Object.keys(GRID_DEFAULTS);
const EDGES = { top: "flex-start", left: "flex-start", middle: "center", center: "center", bottom: "flex-end", right: "flex-end" };
export function alignment(at, direction) {
    const [row, column] = at.split("_");
    return direction === "row" ? { justify: EDGES[column], align: EDGES[row] } : { justify: EDGES[row], align: EDGES[column] };
}
export class GridRegistry {
    constructor() {
        this.cells = $state.raw([]);
    }
    add(cell) {
        this.cells = [...untrack(() => this.cells), cell];
    }
    remove(cell) {
        this.cells = untrack(() => this.cells).filter((other) => other !== cell);
    }
}
const KEY = Symbol("GridLayout");
export function provideGrid() {
    return setContext(KEY, new GridRegistry());
}
export function useGrid() {
    const grid = getContext(KEY);
    if (grid === undefined) {
        throw new Error("A GridCell must be inside a GridLayout");
    }
    return grid;
}
//# sourceMappingURL=grid.svelte.js.map