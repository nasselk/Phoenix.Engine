<script lang="ts">
  import type { GridCellProps } from "../GridLayout/GridLayout.types";
  import { useGrid } from "../GridLayout/grid.svelte";

  const props: GridCellProps = $props();

  const grid = useGrid();

  $effect(() => {
    grid.add(props);

    return () => grid.remove(props);
  });
</script>
