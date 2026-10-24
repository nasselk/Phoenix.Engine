import type { Component } from "svelte";
import type { GridLayoutProps } from "./GridLayout.types";

export type { GridCellProps, GridDirection, GridLayoutProps, GridPosition } from "./GridLayout.types";

declare const GridLayout: Component<GridLayoutProps>;

export default GridLayout;
