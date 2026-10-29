import type { EditorView } from "phoenix.engine/client";

/** What a click in the scene does while the editor is open. */
export type EditorTool = "none" | "camera" | "select" | "move" | "remove";

/** Everything the editor shows and does. The EditorView follows it once `bindEditor` ties them. */
export interface EditorState {
	tool: EditorTool;
	/** Whether the navigation gizmo is shown. */
	gizmo: boolean;
	/** Every mesh drawn as its triangles. */
	wireframe: boolean;
	/** The floor, its grid and the axes. */
	grid: boolean;
	/** The FPS, ping, bandwidth and TPS panels. */
	stats: boolean;
	/** Every light's shadows. */
	shadows: boolean;
	/** The game's own interface (menus, HUD, chat). The editor only flips it: the game hides its interface while it is false. */
	ui: boolean;
}

export interface EngineEditorProps {
	/** The game's editor overlay: the camera tool flies its camera. */
	view: EditorView;
}
