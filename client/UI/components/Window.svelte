<script lang="ts">
  import { Vector } from "@libs/math/vector";

  import ResizableBox from "./ResizableBox.svelte";

  const {
    id = "",
    class: classList = "",
    title = "Window",
    style = "",
    isOpen = true,
    x = undefined,
    y = undefined,
    width = undefined,
    height = undefined,
    minWidth = undefined,
    minHeight = undefined,
    maxWidth = undefined,
    maxHeight = undefined,
    children = () => {},
    padding = "16px",
    resizable = true,
    moveable = true,
  } = $props();

  let box: ResizableBox;
  let header: HTMLDivElement;
  let originalHeight: number;
  let isDragging = false;
  let activePointerId = -1;
  const dragOffset = new Vector();

  const state = $state({
    minimized: false,
    zIndex: 0,
  });

  function focus() {
    state.zIndex = 1000;
  }

  function startDrag(event: PointerEvent): void {
    focus();

    if (moveable) {
      if ((event.target as HTMLElement)?.classList.contains("control")) return;

      box.state.position = "fixed";
      isDragging = true;
      activePointerId = event.pointerId;

      const position = box.getPosition();

      dragOffset.set(event.clientX - position.x, event.clientY - position.y);

      document.addEventListener("pointermove", drag);
      document.addEventListener("pointerup", stopDrag);
      document.addEventListener("pointercancel", stopDrag);

      drag(event);

      event.preventDefault();
    }
  }

  function drag(event: PointerEvent): void {
    if (isDragging && event.pointerId === activePointerId) {
      box.state.x = `${event.clientX - dragOffset.x}px`;
      box.state.y = `${event.clientY - dragOffset.y}px`;

      event.preventDefault();
    }
  }

  function stopDrag() {
    isDragging = false;
    activePointerId = -1;

    document.removeEventListener("pointermove", drag);
    document.removeEventListener("pointerup", stopDrag);
    document.removeEventListener("pointercancel", stopDrag);
  }

  function minimize() {
    originalHeight = box.getSize().height;
    state.minimized = true;

    const headerHeight = header.getBoundingClientRect().height;

    box.state.height = `${headerHeight}px`;
  }

  function expand() {
    box.state.height = `${originalHeight}px`;

    state.minimized = false;
  }

  function close() {
    // You could dispatch an event here for parent components to handle
  }
</script>

{#if isOpen}
  <ResizableBox
    {id}
    class="window {classList}"
    {x}
    {y}
    {width}
    {height}
    {minWidth}
    {minHeight}
    {maxWidth}
    {maxHeight}
    directions={resizable ? undefined : []}
    style={style + `z-index: ${state.zIndex};`}
    transition={state.minimized}
    bind:this={box}
  >
    <div
      class="header {moveable ? 'moveable' : ''}"
      onpointerdown={startDrag}
      bind:this={header}
    >
      <div class="title">{title}</div>
      <div class="controls">
        {#if state.minimized}
          <button
            class="control expand"
            onclick={expand}
            aria-label="Expand window"
          ></button>
        {:else}
          <button
            class="control minimize"
            onclick={minimize}
            aria-label="Minimize window"
          ></button>
        {/if}
        <button class="control close" onclick={close} aria-label="Close window"
        ></button>
      </div>
    </div>
    <div class="content" style="--padding: {padding};" onpointerdown={focus}>
      {@render children()}
    </div>
  </ResizableBox>
{/if}

<style>
  :global(.window) {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: box-shadow 0.2s ease;
    width: 100%;
    height: 100%;
  }

  :global(.window):hover {
    box-shadow:
      0 0.35dvmin 1.5dvmin rgba(0, 0, 0, 0.3),
      0 0.75dvmin 3dvmin rgba(0, 0, 0, 0.2);
  }

  .header {
    background: rgba(60, 60, 60, 0.5);
    padding: 1dvmin 1.5dvmin;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 0.15dvmin solid rgba(150, 150, 150, 0.3);
  }

  .header.moveable:hover {
    cursor: move;
  }

  .title {
    font-weight: 500;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.9);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.05rem;
  }

  .close {
    background: rgba(255, 80, 80, 0.9);
    border: none;
    cursor: pointer;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
  }

  .close:hover {
    background: rgba(255, 60, 60, 1);
    transform: scale(1.1);
  }

  .close::before,
  .close::after {
    content: "";
    position: absolute;
    width: 0.55rem;
    height: 0.1rem;
    background: rgba(255, 255, 255, 0);
    transition: all 0.2s ease;
  }

  .close:hover::before,
  .close:hover::after {
    background: rgba(255, 255, 255, 0.8);
  }

  .close:hover::before {
    transform: rotate(45deg);
  }

  .close:hover::after {
    transform: rotate(-45deg);
  }

  .content {
    flex: 1;
    overflow: auto;
    touch-action: pan-x pan-y;
    color: rgba(255, 255, 255, 0.9);
    padding: var(--padding);
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .minimize {
    background: rgba(255, 191, 0, 0.9);
    border: none;
    cursor: pointer;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
  }

  .minimize:hover {
    background: rgba(255, 191, 0, 1);
    transform: scale(1.1);
  }

  .minimize::before {
    content: "";
    position: absolute;
    width: 0.55rem;
    height: 0.1rem;
    background: rgba(255, 255, 255, 0);
    transition: all 0.2s ease;
  }

  .minimize:hover::before {
    background: rgba(255, 255, 255, 0.8);
  }

  .expand {
    background: rgba(32, 194, 14, 0.9);
    border: none;
    cursor: pointer;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
  }

  .expand:hover {
    background: rgba(32, 194, 14, 1);
    transform: scale(1.1);
  }

  .expand::before,
  .expand::after {
    content: "";
    position: absolute;
    background: rgba(255, 255, 255, 0);
    transition: all 0.2s ease;
  }

  .expand:hover::before,
  .expand:hover::after {
    background: rgba(255, 255, 255, 0.8);
  }

  .expand:hover::before {
    width: 0.55rem;
    height: 0.1rem;
  }

  .expand:hover::after {
    width: 0.1rem;
    height: 0.55rem;
  }
</style>
