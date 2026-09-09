<script lang="ts">
  import {
    activeTool,
    Tools,
    type Tool,
  } from "../../stores/engine/tool.svelte";
  import SelectorHighlight from "./SelectorHighlight.svelte";
  import { onMount, onDestroy } from "svelte";

  const {
    id = "",
    class: classList = "",
    tools = [],
    default: defaultTool = Tools.Default,
  } = $props();

  let highlightComponent: SelectorHighlight;

  function updateHighlight(
    pressed: boolean = false,
    toolId?: Tools,
    event?: PointerEvent,
  ): void {
    if (!event || event.button === 0) {
      const button = document.querySelector(
        `.toolbar > button[data-tool-id="${toolId}"]`,
      ) as HTMLButtonElement;

      highlightComponent.updateHighlight(pressed, true, button);
    }
  }

  function selectTool(tool: Tool): void {
    document.body.style.cursor = tool.cursor;

    activeTool.current = tool;
  }

  function handleGlobalPointerUp() {
    updateHighlight();
  }

  function initializeHighlight() {
    if (tools.length > 0) {
      const firstTool = tools.find((tool) => tool.id === defaultTool);
      const button = document.querySelector<HTMLButtonElement>(
        `.toolbar > button[data-tool-id="${firstTool.id}"]`,
      );

      if (button) {
        activeTool.current = firstTool;
        document.body.style.cursor = firstTool.cursor;

        if (highlightComponent) {
          highlightComponent.updateHighlight(false, true, button);
        }
      }
    }
  }

  onMount(() => {
    window.addEventListener("pointerup", handleGlobalPointerUp);
    initializeHighlight();
  });

  onDestroy(() => {
    window.removeEventListener("pointerup", handleGlobalPointerUp);
  });
</script>

<div class="toolbar {classList}" {id}>
  <SelectorHighlight bind:this={highlightComponent} />

  {#each tools as tool (tool.id)}
    <button
      type="button"
      class="tool {activeTool.current?.id === tool.id ? 'selected' : ''}"
      data-tool-id={tool.id}
      title={tool.label}
      onclick={(event) => selectTool(tool)}
      onpointerdown={(event) => updateHighlight(true, tool.id, event)}
    >
      <img src={tool.icon} alt={tool.label} class="cursor-icon" />
    </button>
  {/each}
</div>

<style>
  .toolbar {
    display: flex;
    position: relative;
    flex-direction: column;
    padding: var(--padding-sm);
    gap: var(--gap-lg);
    transition: all 0.3s ease;
  }

  :global(.toolbar.hidden) {
    opacity: 0;
    transform: translateX(-100%);
  }

  .tool {
    border: none;
    cursor: pointer;
    background-color: transparent;
    position: relative;
    padding: 0;
  }

  .tool > img {
    height: 4.5dvmin;
    width: 4.5dvmin;
    transition: transform 0.3s ease;
    object-fit: contain;
    object-position: center;
  }

  .tool:not(.selected):hover > img {
    transform: scale(1.1);
  }
</style>
