<script lang="ts">
  import type { JoystickProps } from "./Joystick.types";

  const {
    top = "auto",
    left = "auto",
    right = "20dvmin",
    bottom = "20dvmin",
    size = "25dvmin",
    deadZone = 0.15,
    stickyZone,
    fade = true,
    class: classes = "",
    onstart,
    onmove,
    onstop,
  }: JoystickProps = $props();

  let base: HTMLDivElement;
  let stick: HTMLDivElement;

  /** The one finger this joystick answers to, until it lets go. */
  let pointer: number | null = null;

  let held = $state(false);

  // Measured when a finger lands, so a drag never asks the browser for a layout.
  let centerX = 0;
  let centerY = 0;
  let radius = 1;

  function start(event: PointerEvent): void {
    if (pointer !== null) {
      return;
    }

    pointer = event.pointerId;

    try {
      // Keeps the moves coming when the finger slides off the ring. A pointer already gone refuses it.
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    } catch {}

    // A sticky zone puts the ring wherever the finger landed, so the thumb never hunts for it.
    if (stickyZone !== undefined) {
      base.style.left = `${event.clientX - base.offsetWidth / 2}px`;
      base.style.top = `${event.clientY - base.offsetHeight / 2}px`;
      base.style.right = "auto";
      base.style.bottom = "auto";
    }

    held = true;
    // Set here rather than through a class: the class lands a microtask later, and the first move is now.
    stick.style.transition = "none";

    const rect = base.getBoundingClientRect();

    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    radius = rect.width / 2 || 1;

    onstart?.();
    update(event);
  }

  function move(event: PointerEvent): void {
    if (event.pointerId === pointer) {
      update(event);
    }
  }

  function update(event: PointerEvent): void {
    const toX = event.clientX - centerX;
    const toY = event.clientY - centerY;
    const length = Math.hypot(toX, toY);
    // The knob follows the finger out to the rim and no further.
    const reach = Math.min(length, radius);
    const unitX = length === 0 ? 0 : toX / length;
    const unitY = length === 0 ? 0 : toY / length;

    stick.style.translate = `calc(-50% + ${unitX * reach}px) calc(-50% + ${unitY * reach}px)`;

    // What the game reads starts at 0 where the dead zone ends, so nothing jumps as it leaves it.
    const pushed = reach / radius;
    const distance = pushed <= deadZone ? 0 : (pushed - deadZone) / (1 - deadZone);
    const x = unitX * distance;
    const y = -unitY * distance;

    onmove?.({ x, y, angle: distance === 0 ? 0 : Math.atan2(y, x), distance });
  }

  function stop(event: PointerEvent): void {
    if (event.pointerId !== pointer) {
      return;
    }

    pointer = null;
    held = false;

    // Back to the stylesheet's, so it springs back rather than snapping.
    stick.style.transition = "";
    stick.style.translate = "-50% -50%";

    onstop?.();
  }

  // A sticky zone hands over the whole press, so the joystick hears it from there rather than from itself.
  $effect(() => {
    const zone = stickyZone;

    if (zone === undefined) {
      return;
    }

    zone.addEventListener("pointerdown", start);
    zone.addEventListener("pointermove", move);
    zone.addEventListener("pointerup", stop);
    zone.addEventListener("pointercancel", stop);

    return () => {
      zone.removeEventListener("pointerdown", start);
      zone.removeEventListener("pointermove", move);
      zone.removeEventListener("pointerup", stop);
      zone.removeEventListener("pointercancel", stop);
    };
  });
</script>

<div
  class="joystick {classes}"
  class:held
  class:fading={fade && stickyZone !== undefined}
  bind:this={base}
  style:top
  style:left
  style:right
  style:bottom
  style:--joystick-size={size}
  onpointerdown={start}
  onpointermove={move}
  onpointerup={stop}
  onpointercancel={stop}
  aria-hidden="true"
>
  <div class="stick" bind:this={stick}></div>
</div>

<style>
  /*
   * Dressed in the UI kit's own tokens where a game defines them, so it matches its windows and
   * buttons without being told to, and in its own colours where it stands alone.
   */
  .joystick {
    --size: var(--joystick-size, 25dvmin);
    --line: var(--ui-line, 1px);
    --outline: max(2px, calc(2 * var(--line)));
    --accent: var(--ui-accent, #3b82f6);

    position: fixed;
    box-sizing: border-box;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--joystick-base, var(--ui-sunken, rgb(0 0 0 / 0.16)));
    /* Tinted with the accent rather than plain white: over a dark scene the ring has to be findable. */
    border: var(--joystick-base-border, var(--outline) solid color-mix(in srgb, var(--accent) 35%, transparent));
    backdrop-filter: var(--joystick-blur, var(--ui-surface-blur, none));
    z-index: var(--joystick-layer, 1);
    /* A UI layer that lets presses through to the canvas must not let them through here. */
    pointer-events: auto;
    /* The game reads the touches: nothing here scrolls, zooms or gets selected. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    transition: opacity var(--joystick-fade-time, 0.35s);
  }

  /* Out of sight until a finger asks for it. */
  .fading:not(.held) {
    opacity: 0;
  }

  /* The primary button of the kit, round: its blue fill, its lit top edge, and an outline to find it by. */
  .stick {
    position: absolute;
    box-sizing: border-box;
    left: 50%;
    top: 50%;
    width: var(--joystick-stick-size, 50%);
    height: var(--joystick-stick-size, 50%);
    border-radius: 50%;
    background: var(--joystick-stick, var(--ui-accent-fill, #2563eb));
    /* None, like the kit's primary button: the fill is the shape, and an outline on it only muddies it. */
    border: var(--joystick-stick-border, none);
    box-shadow:
      inset 0 var(--line) 0 var(--ui-highlight-strong, rgb(255 255 255 / 0.18)),
      var(--ui-shadow-sm, 0 1px 2px rgb(0 0 0 / 0.3));
    translate: -50% -50%;
    /* Springs back when let go; while held, the transition is taken off so it follows the finger exactly. */
    transition:
      translate var(--joystick-return, 0.15s),
      background-color 0.12s;
  }

  /* Held, it lifts to exactly what the kit's primary button does under a cursor, and nothing else changes. */
  .held .stick {
    background: var(--joystick-stick-held, var(--ui-accent-fill-hover, #2d6aed));
  }
</style>
