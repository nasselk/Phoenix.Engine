const gesturePromise = waitForUserGesture(true);

/**
 * Whether a browser counts this event as the player's gesture, which fullscreen and audio need: a key,
 * a mouse button going down, or a touch or pen being lifted. A touch going down does not count.
 */
function isActivation(event: Event): boolean {
	if (event.type === "keydown") {
		return true;
	}

	const pointer = (event as PointerEvent).pointerType;

	return event.type === "pointerdown" ? pointer === "mouse" : pointer !== "mouse";
}

/**
 * * Waits for a user gesture to be performed before resolving the promise.
 *
 * @param enforceNewGesture - If true, the function will wait for a new user gesture even if one has already been performed. If false, it will resolve immediately if a gesture has already been performed.
 *
 * @returns A promise that resolves when a user gesture is detected.
 */
export async function waitForUserGesture(enforceNewGesture: boolean = false): Promise<void> {
	if (enforceNewGesture) {
		return new Promise((resolve) => {
			const events = ["keydown", "pointerdown", "pointerup"] as const;

			function handler(event: Event): void {
				if (!isActivation(event)) {
					return;
				}

				for (const type of events) {
					window.removeEventListener(type, handler);
				}

				resolve();
			}

			for (const type of events) {
				window.addEventListener(type, handler);
			}
		});
	} else {
		return gesturePromise;
	}
}
