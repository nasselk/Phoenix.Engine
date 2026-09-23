import { OrbitCamera } from "./Camera";
export class TouchCamera extends OrbitCamera {
    constructor(options = {}) {
        super({ rotateSpeed: 0.005, ...options });
        this.touches = new Map();
        this.spread = 0;
        this.onPointerDown = (event) => {
            if (event.pointerType === "mouse" || this.touches.size >= 2) {
                return;
            }
            this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
            this.orbiting = true;
            this.spread = this.apart();
            try {
                event.currentTarget?.setPointerCapture?.(event.pointerId);
            }
            catch { }
        };
        this.onPointerMove = (event) => {
            const touch = this.touches.get(event.pointerId);
            if (touch === undefined) {
                return;
            }
            const x = event.clientX - touch.x;
            const y = event.clientY - touch.y;
            touch.x = event.clientX;
            touch.y = event.clientY;
            if (this.touches.size === 1) {
                this.drag(x, y);
                return;
            }
            const spread = this.apart();
            if (this.spread > 0 && spread > 0) {
                this.pinchBy((spread / this.spread) ** this.pinchSpeed);
            }
            this.spread = spread;
        };
        this.onPointerUp = (event) => {
            if (!this.touches.delete(event.pointerId)) {
                return;
            }
            this.spread = this.apart();
            this.orbiting = this.touches.size > 0;
        };
        this.pinchSpeed = options.pinchSpeed ?? 1;
    }
    listen(element) {
        element.addEventListener("pointerdown", this.onPointerDown);
        element.addEventListener("pointermove", this.onPointerMove);
        element.addEventListener("pointerup", this.onPointerUp);
        element.addEventListener("pointercancel", this.onPointerUp);
    }
    unlisten(element) {
        element.removeEventListener("pointerdown", this.onPointerDown);
        element.removeEventListener("pointermove", this.onPointerMove);
        element.removeEventListener("pointerup", this.onPointerUp);
        element.removeEventListener("pointercancel", this.onPointerUp);
        this.touches.clear();
        this.spread = 0;
    }
    apart() {
        if (this.touches.size !== 2) {
            return 0;
        }
        const [first, second] = [...this.touches.values()];
        return Math.hypot(second.x - first.x, second.y - first.y);
    }
}
