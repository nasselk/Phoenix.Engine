const TEXT_FIELDS = "input, textarea, select, [contenteditable]";
const ZOOM_KEYS = new Set(["+", "-", "=", "_", "0"]);
const VIEWPORT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
function inTextField(target) {
    return target instanceof Element && target.closest(TEXT_FIELDS) !== null;
}
export function native(options = {}) {
    const target = options.target ?? document;
    const undo = [];
    const on = (type, listener, node = target) => {
        node.addEventListener(type, listener, { passive: false });
        undo.push(() => node.removeEventListener(type, listener));
    };
    if (options.contextMenu !== false) {
        on("contextmenu", (event) => {
            if (!inTextField(event.target)) {
                event.preventDefault();
            }
        });
    }
    if (options.drag !== false) {
        on("dragstart", (event) => {
            if (!inTextField(event.target)) {
                event.preventDefault();
            }
        });
    }
    if (options.zoom !== false) {
        for (const gesture of ["gesturestart", "gesturechange", "gestureend"]) {
            on(gesture, (event) => event.preventDefault());
        }
        on("wheel", (event) => {
            if (event.ctrlKey) {
                event.preventDefault();
            }
        });
        on("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && ZOOM_KEYS.has(event.key)) {
                event.preventDefault();
            }
        });
    }
    if (options.viewport !== false) {
        let meta = document.querySelector('meta[name="viewport"]');
        if (meta === null) {
            meta = document.createElement("meta");
            meta.name = "viewport";
            document.head.appendChild(meta);
            undo.push(() => meta?.remove());
        }
        else {
            const previous = meta.content;
            undo.push(() => {
                if (meta !== null) {
                    meta.content = previous;
                }
            });
        }
        meta.content = VIEWPORT;
    }
    return () => {
        for (const off of undo) {
            off();
        }
        undo.length = 0;
    };
}
