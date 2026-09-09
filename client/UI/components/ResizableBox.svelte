<script lang="ts">
  import { Vector } from "@libs/math/vector";

  import { clamp } from "@libs/math/utils";

  const {
    id = "",
    class: classList = "",
    style = "",
    x = "0px",
    y = "0px",
    width = "400px",
    height = "300px",
    minWidth = "0px",
    minHeight = "150px",
    maxWidth = "500px",
    maxHeight = "500px",
    directions = ["n", "e", "s", "w", "nw", "ne", "sw", "se"],
    transition = false,
    children = () => {},
  } = $props();

  // Initialize state with parsed values and export it
  export const state = $state({
    position: x === "0px" && y === "0px" ? "static" : "fixed",
    x,
    y,
    width,
    height,
    transition,
  });

  let box: HTMLDivElement;
  let activePointerID = -1;
  let resizeAxis: keyof typeof handlers;
  const startProperties = { x: 0, y: 0, width: 0, height: 0 };
  const startAnchor = new Vector();

  const handlers = {
    n(dx: number, dy: number): void {
      const newHeight = startProperties.height - dy;
      const constrainedHeight = clamp(
        newHeight,
        parseFloat(minHeight),
        parseFloat(maxHeight),
      );
      const actualDy = startProperties.height - constrainedHeight;

      state.height = `${constrainedHeight}px`;
      state.y = `${startProperties.y + actualDy}px`;
    },

    e(dx: number, dy: number): void {
      const width = Math.max(startProperties.width + dx, parseFloat(minWidth));

      state.width = `${width}px`;
    },

    s(dx: number, dy: number): void {
      const height = Math.max(
        startProperties.height + dy,
        parseFloat(minHeight),
      );

      state.height = `${height}px`;
    },

    w(dx: number, dy: number): void {
      const newWidth = startProperties.width - dx;
      const constrainedWidth = clamp(
        newWidth,
        parseFloat(minWidth),
        parseFloat(maxWidth),
      );
      const actualDx = startProperties.width - constrainedWidth;

      state.width = `${constrainedWidth}px`;
      state.x = `${startProperties.x + actualDx}px`;
    },

    nw(dx: number, dy: number): void {
      handlers.n(dx, dy);
      handlers.w(dx, dy);
    },

    ne(dx: number, dy: number): void {
      handlers.n(dx, dy);
      handlers.e(dx, dy);
    },

    sw(dx: number, dy: number): void {
      handlers.s(dx, dy);
      handlers.w(dx, dy);
    },

    se(dx: number, dy: number): void {
      handlers.s(dx, dy);
      handlers.e(dx, dy);
    },
  };

  function startResize(
    event: PointerEvent,
    direction: keyof typeof handlers,
  ): void {
    // Set the active pointer ID and resize axis
    state.position = "fixed";
    activePointerID = event.pointerId;
    resizeAxis = direction;

    const bounds = box.getBoundingClientRect();

    state.x = `${bounds.x}px`;
    state.y = `${bounds.y}px`;
    startProperties.x = bounds.x;
    startProperties.y = bounds.y;
    startProperties.width = bounds.width;
    startProperties.height = bounds.height;

    startAnchor.set(event.clientX, event.clientY);

    document.addEventListener("pointermove", resize);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
  }

  function resize(event: PointerEvent): void {
    if (event.pointerId === activePointerID) {
      const dx = event.clientX - startAnchor.x;
      const dy = event.clientY - startAnchor.y;

      handlers[resizeAxis](dx, dy);
    }
  }

  function stopResize(): void {
    document.removeEventListener("pointermove", resize);
    document.removeEventListener("pointerup", stopResize);
    document.removeEventListener("pointercancel", stopResize);

    activePointerID = -1;
  }

  export function getPosition(): { x: number; y: number } {
    const position = box.getBoundingClientRect();

    return { x: position.x, y: position.y };
  }

  export function getSize(): { width: number; height: number } {
    const size = box.getBoundingClientRect();

    return { width: size.width, height: size.height };
  }
</script>

<div
  {id}
  class="resizable-box {classList}"
  style="
		position: {state.position};
    	left: {state.x};
    	top: {state.y};
    	width: {state.width ?? minWidth};
    	height: {state.height ?? minHeight};
		transition: {transition ? 'height 0.2s ease, width 0.2s ease' : 'none'};
		{style}
	"
  bind:this={box}
>
  {#each directions as direction}
    <div
      class="resize-handle {direction}"
      onpointerdown={(e) => startResize(e, direction)}
      role="button"
    ></div>
  {/each}

  {@render children()}
</div>

<style>
  .resize-handle {
    position: absolute;
    z-index: 2;
  }

  .resize-handle.n {
    top: -5px;
    left: 0;
    right: 0;
    height: 10px;
    cursor: n-resize;
  }
  .resize-handle.e {
    top: 0;
    right: -5px;
    bottom: 0;
    width: 10px;
    cursor: e-resize;
  }
  .resize-handle.s {
    bottom: -5px;
    left: 0;
    right: 0;
    height: 10px;
    cursor: s-resize;
  }
  .resize-handle.w {
    top: 0;
    left: -5px;
    bottom: 0;
    width: 10px;
    cursor: w-resize;
  }
  .resize-handle.nw {
    top: -5px;
    left: -5px;
    cursor: nw-resize;
  }
  .resize-handle.ne {
    top: -5px;
    right: -5px;
    cursor: ne-resize;
  }
  .resize-handle.sw {
    bottom: -5px;
    left: -5px;
    cursor: sw-resize;
  }
  .resize-handle.se {
    bottom: -5px;
    right: -5px;
    cursor: se-resize;
  }
  .resize-handle.nw,
  .resize-handle.ne,
  .resize-handle.sw,
  .resize-handle.se {
    width: 15px;
    height: 15px;
  }

  .content {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: auto;
    touch-action: pan-x pan-y;
  }
</style>
