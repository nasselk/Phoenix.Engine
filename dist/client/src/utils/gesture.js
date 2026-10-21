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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VzdHVyZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2NsaWVudC9zcmMvdXRpbHMvZ2VzdHVyZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLGNBQWMsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQU1oRCxTQUFTLFlBQVksQ0FBQyxLQUFZO0lBQ2pDLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUM5QixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBSSxLQUFzQixDQUFDLFdBQVcsQ0FBQztJQUVwRCxPQUFPLEtBQUssQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLEtBQUssT0FBTyxDQUFDO0FBQ2pGLENBQUM7QUFTRCxNQUFNLENBQUMsS0FBSyxVQUFVLGtCQUFrQixDQUFDLGlCQUFpQixHQUFZLEtBQUs7SUFDMUUsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1FBQ3ZCLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUM5QixNQUFNLE1BQU0sR0FBRyxDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsV0FBVyxDQUFVLENBQUM7WUFFaEUsU0FBUyxPQUFPLENBQUMsS0FBWTtnQkFDNUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUMxQixPQUFPO2dCQUNSLENBQUM7Z0JBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLEVBQUUsQ0FBQztvQkFDM0IsTUFBTSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDM0MsQ0FBQztnQkFFRCxPQUFPLEVBQUUsQ0FBQztZQUNYLENBQUM7WUFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUMzQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3hDLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7U0FBTSxDQUFDO1FBQ1AsT0FBTyxjQUFjLENBQUM7SUFDdkIsQ0FBQztBQUNGLENBQUMifQ==