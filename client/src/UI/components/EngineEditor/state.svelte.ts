import type { EditorTool } from "./EngineEditor.types";

/** The editor's state, kept apart from its toolbar so anything in the editor can read and change it. */
export const editor = $state<{ tool: EditorTool }>({ tool: "none" });
