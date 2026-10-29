<script module lang="ts">
	export { bindEditor, editor } from "./state.svelte";
</script>

<script lang="ts">
	import Gamepad2 from "@lucide/svelte/icons/gamepad-2";
	import Video from "@lucide/svelte/icons/video";
	import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
	import Move3d from "@lucide/svelte/icons/move-3d";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Box from "@lucide/svelte/icons/box";
	import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
	import Activity from "@lucide/svelte/icons/activity";
	import Axis3d from "@lucide/svelte/icons/axis-3d";
	import Sun from "@lucide/svelte/icons/sun";
	import AppWindow from "@lucide/svelte/icons/app-window";
	import GridCell from "../GridCell/GridCell.svelte";
	import Grid from "../GridLayout/GridLayout.svelte";
	import type { EditorTool, EngineEditorProps } from "./EngineEditor.types";
	import EditorBar from "./EditorBar.svelte";
	import NavigationGizmo from "./NavigationGizmo.svelte";
	import { editor } from "./state.svelte";

	const { view }: EngineEditorProps = $props();

	const TOOLS = [
		{ id: "none", label: "Play", icon: Gamepad2 },
		{ id: "camera", label: "Free camera", icon: Video },
		{ id: "select", label: "Select", icon: MousePointer2 },
		{ id: "move", label: "Move and rotate", icon: Move3d },
		{ id: "remove", label: "Remove", icon: Trash2 },
	] as const satisfies readonly { id: EditorTool; label: string; icon: unknown }[];

	const TOGGLES = [
		{ id: "wireframe", label: "Wireframe", icon: Box },
		{ id: "grid", label: "Grid and axes", icon: Grid3x3 },
		{ id: "shadows", label: "Shadows", icon: Sun },
		{ id: "stats", label: "Stats", icon: Activity },
		{ id: "gizmo", label: "Navigation gizmo", icon: Axis3d },
		{ id: "ui", label: "Game interface", icon: AppWindow },
	] as const;
</script>

<Grid>
	<GridCell at="middle_left">
		<div class="bars">
			<EditorBar label="Editor tools" mode="one" items={TOOLS} active={(id) => editor.tool === id} onpick={(id) => (editor.tool = id)} />
			<EditorBar label="Editor view toggles" mode="many" items={TOGGLES} active={(id) => editor[id]} onpick={(id) => (editor[id] = !editor[id])} />
		</div>
	</GridCell>

	{#if editor.gizmo}
		<GridCell at="bottom_right">
			<NavigationGizmo {view} />
		</GridCell>
	{/if}
</Grid>

<style>
	.bars {
		--unit: calc(100vmin / 720);

		display: flex;
		flex-direction: column;
		gap: calc(8 * var(--unit));
		margin-left: calc(14 * var(--unit));
	}

	@media (pointer: coarse) {
		.bars {
			--unit: calc(100vmin / 540);
		}
	}
</style>
