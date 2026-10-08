import { OrbitCamera } from "./Camera";
export class DesktopCamera extends OrbitCamera {
    constructor(options = {}) {
        super(options);
        this.pointer = -1;
        this.onPointerDown = (event) => {
            if (this.dragging && event.button === this.button) {
                this.pointer = event.pointerId;
                this.orbiting = true;
            }
        };
        this.onPointerMove = (event) => {
            if (event.pointerId === this.pointer) {
                this.drag(event.movementX, event.movementY);
            }
        };
        this.onPointerUp = (event) => {
            if (event.pointerId === this.pointer) {
                this.pointer = -1;
                this.orbiting = false;
            }
        };
        this.onWheel = (event) => {
            this.zoomByDelta(event.deltaY);
        };
        this.button = options.button ?? 0;
    }
    listen(element) {
        element.addEventListener("pointerdown", this.onPointerDown);
        element.addEventListener("wheel", this.onWheel, { passive: true });
        window.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("pointerup", this.onPointerUp);
        window.addEventListener("pointercancel", this.onPointerUp);
    }
    unlisten(element) {
        element.removeEventListener("pointerdown", this.onPointerDown);
        element.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("pointermove", this.onPointerMove);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointercancel", this.onPointerUp);
        this.pointer = -1;
    }
}
