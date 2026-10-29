export const editor = $state({ tool: "none", gizmo: true, wireframe: false, grid: true, stats: true, shadows: true, ui: true });
export function bindEditor(view) {
    return $effect.root(() => {
        $effect(() => view.fly(editor.tool === "camera"));
        $effect(() => view.toggleWireframe(editor.wireframe));
        $effect(() => view.toggleGrid(editor.grid));
        $effect(() => view.toggleStats(editor.stats));
        $effect(() => view.toggleShadows(editor.shadows));
    });
}
//# sourceMappingURL=state.svelte.js.map