import type { Component } from "svelte";
import type { EngineEditorProps } from "./EngineEditor.types";

export type { EditorTool, EngineEditorProps } from "./EngineEditor.types";

declare const EngineEditor: Component<EngineEditorProps>;

export default EngineEditor;
