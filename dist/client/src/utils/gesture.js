const gesturePromise = waitForUserGesture(true);
function isActivation(event) {
    if (event.type === "keydown") {
        return true;
    }
    const pointer = event.pointerType;
    return event.type === "pointerdown" ? pointer === "mouse" : pointer !== "mouse";
}
export async function waitForUserGesture(enforceNewGesture = false) {
    if (enforceNewGesture) {
        return new Promise((resolve) => {
            const events = ["keydown", "pointerdown", "pointerup"];
            function handler(event) {
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
    }
    else {
        return gesturePromise;
    }
}
