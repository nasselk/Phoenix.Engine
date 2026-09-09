const gesturePromise = waitForUserGesture(true);
export async function waitForUserGesture(enforceNewGesture = false) {
    if (enforceNewGesture) {
        return new Promise((resolve) => {
            function handler() {
                resolve();
            }
            window.addEventListener("pointerdown", handler, { once: true });
            window.addEventListener("keydown", handler, { once: true });
        });
    }
    else {
        return gesturePromise;
    }
}
