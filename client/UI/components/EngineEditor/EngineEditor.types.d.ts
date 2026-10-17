import type { EditorView } from "phoenix.engine/client";

/** What a click in the scene does while the editor is open. */
export type EditorTool = "none" | "camera" | "select" | "move" | "remove";

export interface EngineEditorProps {
	/** The game's editor overlay: the camera tool flies its camera. */
	view: EditorView;
}
