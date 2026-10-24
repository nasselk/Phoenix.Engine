import type { GridCellProps, GridDirection, GridPosition } from "./GridLayout.types";
export declare const GRID_DEFAULTS: Readonly<Record<GridPosition, {
    readonly direction: GridDirection;
    readonly z: number;
}>>;
export declare const GRID_POSITIONS: GridPosition[];
export declare function alignment(at: GridPosition, direction: GridDirection): {
    readonly justify: string;
    readonly align: string;
};
export declare class GridRegistry {
    cells: GridCellProps[];
    add(cell: GridCellProps): void;
    remove(cell: GridCellProps): void;
}
export declare function provideGrid(): GridRegistry;
export declare function useGrid(): GridRegistry;
//# sourceMappingURL=grid.svelte.d.ts.map