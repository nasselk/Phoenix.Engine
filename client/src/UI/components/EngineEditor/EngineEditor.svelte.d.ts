import type { EditorView } from "phoenix.engine/client";
import type { Component } from "svelte";
import type { EditorState, EngineEditorProps } from "./EngineEditor.types";

export type { EditorState, EditorTool, EngineEditorProps } from "./EngineEditor.types";

/** Everything the editor shows and does, for the bars to read and change: `bindEditor` makes the view follow it. */
export declare const editor: EditorState;

/** Make this view follow `editor` until the returned function is called. Call it once where the view is made. */
export declare function bindEditor(view: EditorView): () => void;

declare const EngineEditor: Component<EngineEditorProps>;

export default EngineEditor;
