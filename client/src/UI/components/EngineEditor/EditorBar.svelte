<script lang="ts" generics="T extends string">
	import type { Component } from "svelte";

	interface Props {
		/** What the bar is for, read by screen readers. */
		label: string;
		items: readonly { id: T; label: string; icon: Component<any> }[];
		/** `one`: a single button active at a time, marked by a sliding highlight, like tools. `many`: each button on or off by itself, like toggles. */
		mode: "one" | "many";
		active: (id: T) => boolean;
		onpick: (id: T) => void;
	}

	const { label, items, mode, active, onpick }: Props = $props();

	const index = $derived(mode === "one" ? items.findIndex((item) => active(item.id)) : -1);
</script>

<div class="bar" role="toolbar" aria-label={label} aria-orientation="vertical" style:--index={index}>
	{#if mode === "one" && index >= 0}
		<span class="indicator" aria-hidden="true"></span>
	{/if}

	{#each items as item (item.id)}
		<button type="button" class="button" class:selected={mode === "one" && active(item.id)} class:on={mode === "many" && active(item.id)} aria-label={item.label} aria-pressed={active(item.id)} title={item.label} onclick={() => onpick(item.id)}>
			<item.icon />
		</button>
	{/each}
</div>

<style>
	.bar {
		--unit: calc(100vmin / 720);
		--button: calc(26 * var(--unit));
		--gap: calc(2 * var(--unit));
		--pad: calc(3 * var(--unit));
		--radius: calc(11 * var(--unit));
		--orange: 255, 146, 56;
		--line: max(1px, round(down, var(--unit), 1px));

		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--gap);
		padding: var(--pad);
		border: var(--line) solid rgba(255, 255, 255, 0.14);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.07);
		backdrop-filter: blur(calc(18 * var(--unit))) saturate(1.6);
		-webkit-backdrop-filter: blur(calc(18 * var(--unit))) saturate(1.6);
		pointer-events: auto;
		user-select: none;
	}

	.indicator {
		position: absolute;
		top: var(--pad);
		left: var(--pad);
		width: var(--button);
		height: var(--button);
		border-radius: calc(var(--radius) - var(--pad));
		background: rgba(var(--orange), 0.28);
		box-shadow: inset 0 0 0 var(--line) rgba(var(--orange), 0.45);
		transform: translateY(calc(var(--index) * (var(--button) + var(--gap))));
		transition: transform 0.28s cubic-bezier(0.2, 0.9, 0.25, 1.12);
	}

	.button {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--button);
		height: var(--button);
		padding: 0;
		border: 0;
		border-radius: calc(var(--radius) - var(--pad));
		background: transparent;
		color: rgba(255, 255, 255, 0.62);
		cursor: pointer;
		transition:
			color 0.18s ease,
			background-color 0.18s ease,
			box-shadow 0.18s ease,
			transform 0.12s ease;
	}

	.button :global(svg) {
		width: calc(16 * var(--unit)) !important;
		height: calc(16 * var(--unit)) !important;
	}

	.button:hover:not(.selected):not(.on) {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.95);
	}

	.button:active {
		transform: scale(0.92);
	}

	.button.selected {
		color: #ffd2ad;
	}

	.button.on {
		background: rgba(var(--orange), 0.28);
		box-shadow: inset 0 0 0 var(--line) rgba(var(--orange), 0.45);
		color: #ffd2ad;
	}

	.button:focus-visible {
		outline: calc(1.5 * var(--unit)) solid rgba(var(--orange), 0.7);
		outline-offset: calc(-1.5 * var(--unit));
	}

	@media (pointer: coarse) {
		.bar {
			--unit: calc(100vmin / 540);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.indicator,
		.button {
			transition: none;
		}
	}
</style>
