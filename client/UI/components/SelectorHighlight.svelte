<script lang="ts">
  import { Timeout } from "@utils/timers/timer";

  const state = $state({
    style: "",
    pressed: false,
    active: false,
  });

  let lastTarget: HTMLElement | undefined;

  export function updateHighlight(
    pressed: boolean = false,
    active: boolean = true,
    target?: HTMLElement,
  ): void {
    if (!target) {
      target = lastTarget;
    } else {
      lastTarget = target;
    }

    if (target) {
      const rect = target.getBoundingClientRect();

      const width = rect.width * 1.225 + (pressed ? 10 : 0);
      const height = rect.height * 1.225;

      const offsetWidth = width - rect.width;
      const offsetHeight = height - rect.height;

      state.style = `
               	left: ${target.offsetLeft - offsetWidth / 2}px;
               	top: ${target.offsetTop - offsetHeight / 2}px;
               	width: ${width}px;
               	height: ${height}px;
           	`;
    }

    state.pressed = pressed;
    state.active = active;
  }

  window.addEventListener("resize", function () {
    new Timeout(() => {
      updateHighlight(state.pressed, state.active, lastTarget);
    }, 300);
  });
</script>

<div
  class="highlight"
  style={state.style +
    ` transform: scale(${state.active ? 1 : 0}); opacity: ${state.active ? 1 : 0}`}
></div>

<style>
  .highlight {
    position: absolute;
    box-sizing: border-box;
    background-color: rgba(255, 165, 0, 0.25);
    border: var(--border-md) rgba(255, 165, 0, 0.5);
    transform-origin: center center;
    transition: all 0.3s ease;
    transform: scale(0);
    border-radius: var(--radius-md);
    opacity: 0;
  }
</style>
