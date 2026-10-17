import { OrbitCamera } from "./Camera";
export class DesktopCamera extends OrbitCamera {
    constructor(options = {}) {
        super(options);
        this.pointer = -1;
        this.panPointer = -1;
        this.onPointerDown = (event) => {
            if (this.dragging && event.button === (this.free ? this.freeButton : this.button)) {
                this.pointer = event.pointerId;
                this.orbiting = true;
            }
            else if (this.free && event.button === this.panButton) {
                this.panPointer = event.pointerId;
            }
        };
        this.onPointerMove = (event) => {
            if (event.pointerId === this.pointer) {
                this.drag(event.movementX, event.movementY);
            }
            if (event.pointerId === this.panPointer) {
                this.pan(event.movementX, event.movementY);
            }
        };
        this.onPointerUp = (event) => {
            if (event.pointerId === this.pointer) {
                this.pointer = -1;
                this.orbiting = false;
            }
            if (event.pointerId === this.panPointer) {
                this.panPointer = -1;
            }
        };
        this.onWheel = (event) => {
            this.zoomByDelta(event.deltaY);
        };
        this.button = options.button ?? 0;
        this.freeButton = options.freeButton ?? 2;
        this.panButton = options.panButton ?? 0;
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
        this.pointer = this.panPointer = -1;
    }
}
