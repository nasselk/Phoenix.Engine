/** The elements a person types in, where the browser's own behaviour is what they expect. */
const TEXT_FIELDS = "input, textarea, select, [contenteditable]";

/** Zoom shortcuts, on every layout: ctrl/⌘ with plus, minus or zero. */
const ZOOM_KEYS = new Set(["+", "-", "=", "_", "0"]);

const VIEWPORT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

export type NativeOptions = {
	/** Where to listen. The document by default, so nothing in the page is missed. */
	readonly target?: Document | HTMLElement;
	/** Drop the right-click menu, except in a text field. */
	readonly contextMenu?: boolean;
	/** Drop every way to zoom: Safari's pinch, ctrl with the wheel, and the keyboard shortcuts. */
	readonly zoom?: boolean;
	/** Drop dragging images and links out of the page. */
	readonly drag?: boolean;
	/** Write the viewport meta tag phones need, which is what stops pinch zoom there. */
	readonly viewport?: boolean;
};

function inTextField(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(TEXT_FIELDS) !== null;
}

/**
 * What native.css cannot do on its own. Call it once the page exists, and keep what it hands back to
 * put every one of these behaviours back:
 *
 *   const stop = native();
 *
 * Everything is on unless it is turned off, and a text field is left alone throughout: its menu, its
 * selection and its own drag still work.
 */
export function native(options: NativeOptions = {}): () => void {
	const target = options.target ?? document;
	const undo: (() => void)[] = [];

	const on = <E extends Event>(type: string, listener: (event: E) => void, node: EventTarget = target): void => {
		node.addEventListener(type, listener as EventListener, { passive: false });

		undo.push(() => node.removeEventListener(type, listener as EventListener));
	};

	if (options.contextMenu !== false) {
		on("contextmenu", (event: MouseEvent) => {
			if (!inTextField(event.target)) {
				event.preventDefault();
			}
		});
	}

	if (options.drag !== false) {
		on("dragstart", (event: DragEvent) => {
			if (!inTextField(event.target)) {
				event.preventDefault();
			}
		});
	}

	if (options.zoom !== false) {
		// Safari's pinch, which it reports as gestures of its own rather than as touches.
		for (const gesture of ["gesturestart", "gesturechange", "gestureend"]) {
			on(gesture, (event: Event) => event.preventDefault());
		}

		// Ctrl with the wheel is how a desktop browser zooms, and a trackpad pinch arrives as one too.
		on("wheel", (event: WheelEvent) => {
			if (event.ctrlKey) {
				event.preventDefault();
			}
		});

		on("keydown", (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && ZOOM_KEYS.has(event.key)) {
				event.preventDefault();
			}
		});
	}

	if (options.viewport !== false) {
		let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');

		if (meta === null) {
			meta = document.createElement("meta");
			meta.name = "viewport";

			document.head.appendChild(meta);

			undo.push(() => meta?.remove());
		} else {
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
