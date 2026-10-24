import { getContext, setContext, untrack } from "svelte";
import type { GridCellProps, GridDirection, GridPosition } from "./GridLayout.types";

/** Each cell's default direction and layer, in reading order. */
export const GRID_DEFAULTS: Readonly<Record<GridPosition, { readonly direction: GridDirection; readonly z: number }>> = {
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

export const GRID_POSITIONS = Object.keys(GRID_DEFAULTS) as GridPosition[];

const EDGES = { top: "flex-start", left: "flex-start", middle: "center", center: "center", bottom: "flex-end", right: "flex-end" } as const;

/** Pushes a cell's content toward its own corner or edge, whichever way the cell stacks it. */
export function alignment(at: GridPosition, direction: GridDirection): { readonly justify: string; readonly align: string } {
	const [row, column] = at.split("_") as [keyof typeof EDGES, keyof typeof EDGES];

	return direction === "row" ? { justify: EDGES[column], align: EDGES[row] } : { justify: EDGES[row], align: EDGES[column] };
}

/** The `GridCell`s of one `GridLayout`, as their live props, in the order they were created. */
export class GridRegistry {
	public cells: GridCellProps[] = $state.raw([]);

	public add(cell: GridCellProps): void {
		this.cells = [...untrack(() => this.cells), cell];
	}

	public remove(cell: GridCellProps): void {
		this.cells = untrack(() => this.cells).filter((other) => other !== cell);
	}
}

const KEY = Symbol("GridLayout");

export function provideGrid(): GridRegistry {
	return setContext(KEY, new GridRegistry());
}

export function useGrid(): GridRegistry {
	const grid = getContext<GridRegistry | undefined>(KEY);

	if (grid === undefined) {
		throw new Error("A GridCell must be inside a GridLayout");
	}

	return grid;
}
