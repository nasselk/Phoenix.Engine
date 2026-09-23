import type { Snippet } from "svelte";

export type GridDirection = "column" | "row";

export interface GridLayoutProps {
	id?: string;
	class?: string;
	padding?: string;
	gap?: string;

	top_left?: Snippet | null;
	top_center?: Snippet | null;
	top_right?: Snippet | null;
	middle_left?: Snippet | null;
	middle_center?: Snippet | null;
	middle_right?: Snippet | null;
	bottom_left?: Snippet | null;
	bottom_center?: Snippet | null;
	bottom_right?: Snippet | null;

	top_left_direction?: GridDirection;
	top_center_direction?: GridDirection;
	top_right_direction?: GridDirection;
	middle_left_direction?: GridDirection;
	middle_center_direction?: GridDirection;
	middle_right_direction?: GridDirection;
	bottom_left_direction?: GridDirection;
	bottom_center_direction?: GridDirection;
	bottom_right_direction?: GridDirection;
}
