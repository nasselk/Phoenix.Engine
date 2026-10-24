import type { Snippet } from "svelte";

export type GridDirection = "column" | "row";

export type GridPosition = "top_left" | "top_center" | "top_right" | "middle_left" | "middle_center" | "middle_right" | "bottom_left" | "bottom_center" | "bottom_right";

export interface GridLayoutProps {
	id?: string;
	class?: string;
	/** Every cell's space from the screen's edges, unless a `GridCell` sets its own. */
	padding?: string;
	/** Every cell's space between what it holds, unless a `GridCell` sets its own. */
	gap?: string;
	/** The grid's `GridCell`s. */
	children?: Snippet;
}

export interface GridCellProps {
	/** Which of the nine cells this content goes in. */
	at: GridPosition;
	/** How the cell stacks what it holds. Defaults to "row" in the centre column, "column" on the sides. */
	direction?: GridDirection;
	/** Which cell draws on top where cells overlap: higher wins. Defaults: middle_center 4; top_center and the bottom corners 3; bottom_center, middle_left and middle_right 2; the top corners 1. */
	z?: number;
	/** This cell's space from the screen's edges, instead of the grid's `padding`. */
	padding?: string;
	/** This cell's space between what it holds, instead of the grid's `gap`. */
	gap?: string;
	children: Snippet;
}
