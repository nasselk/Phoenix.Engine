<script lang="ts">
	import Gamepad2 from "@lucide/svelte/icons/gamepad-2";
	import Video from "@lucide/svelte/icons/video";
	import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
	import Move3d from "@lucide/svelte/icons/move-3d";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Grid from "../GridLayout/GridLayout.svelte";
	import type { EditorTool } from "./EngineEditor.types";

	const TOOLS = [
		{ id: "none", label: "Play", icon: Gamepad2 },
		{ id: "camera", label: "Free camera", icon: Video },
		{ id: "select", label: "Select", icon: MousePointer2 },
		{ id: "move", label: "Move and rotate", icon: Move3d },
		{ id: "remove", label: "Remove", icon: Trash2 },
	] as const satisfies readonly { id: EditorTool; label: string; icon: unknown }[];

	let tool: EditorTool = $state("none");

	const index = $derived(TOOLS.findIndex((entry) => entry.id === tool));
</script>

<Grid>
	{#snippet middle_left()}
		<div class="toolbar" role="toolbar" aria-label="Editor tools" aria-orientation="vertical" style:--index={index}>
			<span class="indicator" aria-hidden="true"></span>

			{#each TOOLS as entry (entry.id)}
				<button type="button" class="tool" class:selected={tool === entry.id} aria-label={entry.label} aria-pressed={tool === entry.id} title={entry.label} onclick={() => (tool = entry.id)}>
					<entry.icon />
				</button>
			{/each}
		</div>
	{/snippet}
</Grid>

<style>
	.toolbar {
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
		margin-left: calc(14 * var(--unit));
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

	.tool {
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
			transform 0.12s ease;
	}

	.tool :global(svg) {
		width: calc(16 * var(--unit)) !important;
		height: calc(16 * var(--unit)) !important;
	}

	.tool:hover:not(.selected) {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.95);
	}

	.tool:active {
		transform: scale(0.92);
	}

	.tool.selected {
		color: #ffd2ad;
	}

	.tool:focus-visible {
		outline: calc(1.5 * var(--unit)) solid rgba(var(--orange), 0.7);
		outline-offset: calc(-1.5 * var(--unit));
	}

	@media (pointer: coarse) {
		.toolbar {
			--unit: calc(100vmin / 540);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.indicator,
		.tool {
			transition: none;
		}
	}
</style>
