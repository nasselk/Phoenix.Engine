<script lang="ts">
  import { warn } from "../../../../../shared/utils/logger";
  import type { GridLayoutProps } from "./GridLayout.types";
  import { alignment, GRID_DEFAULTS, GRID_POSITIONS, provideGrid } from "./grid.svelte";

  const { id = "", class: classList = "", padding = "0px", gap = "0px", children }: GridLayoutProps = $props();

  const grid = provideGrid();

  const cells = $derived(
    GRID_POSITIONS.map((at) => {
      const entries = grid.cells.filter((cell) => cell.at === at);
      const direction = entries.find((cell) => cell.direction !== undefined)?.direction ?? GRID_DEFAULTS[at].direction;
      const z = entries.find((cell) => cell.z !== undefined)?.z ?? GRID_DEFAULTS[at].z;
      const cellPadding = entries.find((cell) => cell.padding !== undefined)?.padding ?? padding;
      const cellGap = entries.find((cell) => cell.gap !== undefined)?.gap ?? gap;

      return { at, entries, direction, z, padding: cellPadding, gap: cellGap, alignment: alignment(at, direction) };
    }),
  );

  $effect(() => {
    for (const cell of cells) {
      const differs = (key: "direction" | "z" | "padding" | "gap") => cell.entries.some((entry) => entry[key] !== undefined && entry[key] !== cell[key]);

      if (differs("direction") || differs("z") || differs("padding") || differs("gap")) {
        warn("GridLayout", `GridCells at "${cell.at}" set different options; the first one to set each is used: direction ${cell.direction}, z ${cell.z}, padding ${cell.padding}, gap ${cell.gap}`);
      }
    }
  });
</script>

{@render children?.()}

<div {id} class="grid {classList}">
  {#each cells as cell (cell.at)}
    <div
      class="cell"
      style="flex-direction: {cell.direction}; justify-content: {cell.alignment.justify}; align-items: {cell.alignment.align}; padding: {cell.padding}; gap: {cell.gap}; z-index: {cell.z};"
    >
      {#each cell.entries as entry (entry)}
        {@render entry.children()}
      {/each}
    </div>
  {/each}
</div>

<style>
  .grid {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    height: 100%;
    width: 100%;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    isolation: isolate;
    pointer-events: none;
  }

  .cell {
    display: flex;
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .cell > :global(*) {
    flex-shrink: 0;
    pointer-events: auto;
  }
</style>
