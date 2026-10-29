import type { EditorView } from "phoenix.engine/client";
import type { EditorState } from "./EngineEditor.types";

/** Everything the editor shows and does, for the bars to read and change: `bindEditor` makes the view follow it. */
export const editor = $state<EditorState>({ tool: "none", gizmo: true, wireframe: false, grid: true, stats: true, shadows: true, ui: true });

/**
 * Make this view follow `editor` from now on, whether or not the EngineEditor is on screen: the free
 * camera tool flies its camera, and wireframe, grid, stats and shadows show as set.
 * Call it once where the view is made, and call what it returns when the view goes.
 */
export function bindEditor(view: EditorView): () => void {
	return $effect.root(() => {
		$effect(() => view.fly(editor.tool === "camera"));
		$effect(() => view.toggleWireframe(editor.wireframe));
		$effect(() => view.toggleGrid(editor.grid));
		$effect(() => view.toggleStats(editor.stats));
		$effect(() => view.toggleShadows(editor.shadows));
	});
}
