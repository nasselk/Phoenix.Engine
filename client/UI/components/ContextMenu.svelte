<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    callback: () => void;
  }

  const { menuItems = [], selector = "body" } = $props<{
    menuItems: ContextMenuItem[][];
    selector?: string;
  }>();

  let isVisible = $state(false);
  let posX = $state(0);
  let posY = $state(0);
  let menuElement: HTMLDivElement;
  let targetElement: HTMLElement | null = null;

  function showMenu(event: MouseEvent) {
    // Prevent default context menu
    event.preventDefault();

    // Position menu at cursor
    posX = event.clientX;
    posY = event.clientY;

    // Make menu visible
    isVisible = true;

    // Ensure menu stays within viewport
    setTimeout(() => {
      if (!menuElement) return;

      const rect = menuElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position if needed
      if (rect.right > viewportWidth) {
        posX -= rect.right - viewportWidth + 10;
      }

      // Adjust vertical position if needed
      if (rect.bottom > viewportHeight) {
        posY -= rect.bottom - viewportHeight + 10;
      }
    }, 0);
  }

  function hideMenu() {
    isVisible = false;
  }

  function handleItemClick(item: ContextMenuItem) {
    if (!item.disabled) {
      item.callback();
      hideMenu();
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      isVisible &&
      menuElement &&
      !menuElement.contains(event.target as Node)
    ) {
      hideMenu();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (isVisible && event.key === "Escape") {
      hideMenu();
    }
  }

  onMount(() => {
    // Find the target element to attach context menu
    targetElement = document.querySelector(selector);

    if (!targetElement) {
      console.error(
        `ContextMenu: Target element not found with selector "${selector}"`,
      );
      targetElement = document.body; // Fallback to body
    }

    targetElement.addEventListener("contextmenu", showMenu);
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    if (targetElement) {
      targetElement.removeEventListener("contextmenu", showMenu);
    }
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });
</script>

{#if menuItems.length > 0}
  <div
    class="context-menu {isVisible ? 'visible' : ''}"
    bind:this={menuElement}
    style="left: {posX}px; top: {posY}px;"
  >
    {#each menuItems as category, categoryIndex}
      {#if category.length > 0}
        <div class="category">
          {#each category as item}
            <div
              class="menu-item {item.disabled ? 'disabled' : ''}"
              on:click={() => handleItemClick(item)}
            >
              {#if item.icon}
                <img src={item.icon} alt="" class="icon" />
              {/if}
              <span class="label">{item.label}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    min-width: 180px;
    background: rgba(50, 50, 50, 0.2);
    box-shadow: 0 0.25dvmin 1dvmin rgba(0, 0, 0, 0.25);
    -webkit-backdrop-filter: blur(3px);
    backdrop-filter: blur(3px);
    border: 0.25dvmin solid rgba(150, 150, 150, 0.3);
    border-radius: 2dvmin;
    padding: 0.8dvmin;
    z-index: 9999;
    color: #f0f0f0;
    font-size: 14px;
    visibility: hidden;
    opacity: 0;
    transform: scale(0.98);
    transform-origin: top left;
    max-height: 0;
    overflow: hidden;
    transition:
      opacity 0.2s ease,
      transform 0.2s ease,
      visibility 0s 0.2s,
      max-height 0.3s ease;
  }

  .context-menu.visible {
    visibility: visible;
    opacity: 1;
    transform: scale(1);
    max-height: 500px; /* Large enough to contain most menus */
    transition:
      opacity 0.2s ease,
      transform 0.2s ease,
      max-height 0.3s ease,
      visibility 0s;
    pointer-events: auto;
  }

  .category {
    padding: 0;
    margin-bottom: 5px;
  }

  .category:not(:last-child) {
    border-bottom: 1px solid rgba(150, 150, 150, 0.2);
    padding-bottom: 5px;
    margin-bottom: 5px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 1.5dvmin;
    transition: all 0.2s ease;
    margin: 2px 0;
  }

  .menu-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: translateX(2px);
  }

  .menu-item.disabled {
    opacity: 0.5;
    cursor: default;
  }

  .menu-item.disabled:hover {
    background-color: transparent;
    transform: none;
  }

  .icon {
    width: 18px;
    height: 18px;
    margin-right: 10px;
    object-fit: contain;
  }

  .label {
    white-space: nowrap;
    letter-spacing: 0.02em;
    font-weight: 400;
  }
</style>
