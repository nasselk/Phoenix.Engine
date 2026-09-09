const gesturePromise = waitForUserGesture(true);

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
			function handler() {
				resolve();
			}

			window.addEventListener("pointerdown", handler, { once: true });
			window.addEventListener("keydown", handler, { once: true });
		});
	} else {
		return gesturePromise;
	}
}
