<script lang="ts">
  import type { GridLayoutProps } from "./GridLayout.types";

  const {
    id = "",
    class: classList = "",
    padding = "0px",
    gap = "0px",

    top_left = null,
    top_center = null,
    top_right = null,
    middle_left = null,
    middle_center = null,
    middle_right = null,
    bottom_left = null,
    bottom_center = null,
    bottom_right = null,

    top_left_direction = "column",
    top_center_direction = "row",
    top_right_direction = "column",
    middle_left_direction = "column",
    middle_center_direction = "row",
    middle_right_direction = "column",
    bottom_left_direction = "column",
    bottom_center_direction = "row",
    bottom_right_direction = "column",
  }: GridLayoutProps = $props();

  // Define positions with both column and row alignments
  const cells = $derived([
    {
      name: "top-left",
      render: top_left,
      flex: top_left_direction,
      alignment: {
        column: { justify: "flex-start", align: "flex-start" },
        row: { justify: "flex-start", align: "flex-start" },
      },
    },
    {
      name: "top-center",
      render: top_center,
      flex: top_center_direction,
      alignment: {
        column: { justify: "flex-start", align: "center" },
        row: { justify: "center", align: "flex-start" },
      },
    },
    {
      name: "top-right",
      render: top_right,
      flex: top_right_direction,
      alignment: {
        column: { justify: "flex-start", align: "flex-end" },
        row: { justify: "flex-end", align: "flex-start" },
      },
    },
    {
      name: "middle-left",
      render: middle_left,
      flex: middle_left_direction,
      alignment: {
        column: { justify: "center", align: "flex-start" },
        row: { justify: "flex-start", align: "center" },
      },
    },
    {
      name: "middle-center",
      render: middle_center,
      flex: middle_center_direction,
      alignment: {
        column: { justify: "center", align: "center" },
        row: { justify: "center", align: "center" },
      },
    },
    {
      name: "middle-right",
      render: middle_right,
      flex: middle_right_direction,
      alignment: {
        column: { justify: "center", align: "flex-end" },
        row: { justify: "flex-end", align: "center" },
      },
    },
    {
      name: "bottom-left",
      render: bottom_left,
      flex: bottom_left_direction,
      alignment: {
        column: { justify: "flex-end", align: "flex-start" },
        row: { justify: "flex-start", align: "flex-end" },
      },
    },
    {
      name: "bottom-center",
      render: bottom_center,
      flex: bottom_center_direction,
      alignment: {
        column: { justify: "flex-end", align: "center" },
        row: { justify: "center", align: "flex-end" },
      },
    },
    {
      name: "bottom-right",
      render: bottom_right,
      flex: bottom_right_direction,
      alignment: {
        column: { justify: "flex-end", align: "flex-end" },
        row: { justify: "flex-end", align: "flex-end" },
      },
    },
  ]);
</script>

<div {id} class="grid {classList}">
  {#each cells as cell}
    {@const alignment = cell.alignment[cell.flex]}
    <div
      class="cell"
      style="flex-direction: {cell.flex}; justify-content: {alignment.justify}; align-items: {alignment.align};"
    >
      <div
        class="content"
        style="padding: {padding}; gap: {gap}; flex-direction: {cell.flex};"
      >
        {@render cell.render?.()}
      </div>
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
    pointer-events: none;
  }

  .cell {
    display: flex;
    min-width: 0;
    min-height: 0;
  }

  .content {
    display: flex;
    position: relative;
    align-items: inherit;
    z-index: 1;
  }

  :global(.content > *) {
    pointer-events: auto;
  }
</style>
