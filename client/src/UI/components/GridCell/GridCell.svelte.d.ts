import type { Component } from "svelte";
import type { GridCellProps } from "../GridLayout/GridLayout.types";

export type { GridCellProps, GridDirection, GridPosition } from "../GridLayout/GridLayout.types";

declare const GridCell: Component<GridCellProps>;

export default GridCell;
