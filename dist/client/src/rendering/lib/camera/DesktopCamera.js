import { Vector3 } from "three";
import { OrbitCamera } from "./Camera";
export class DesktopCamera extends OrbitCamera {
    constructor(options = {}) {
        super(options);
        this.pointer = -1;
        this.held = new Set();
        this.forward = new Vector3();
        this.right = new Vector3();
        this.step = new Vector3();
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
        this.onKeyDown = (event) => {
            const target = event.target;
            if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }
            this.held.add(event.code);
        };
        this.onKeyUp = (event) => {
            this.held.delete(event.code);
        };
        this.onBlur = () => {
            this.held.clear();
        };
        this.button = options.button ?? 0;
        this.flySpeed = options.flySpeed ?? 20;
        this.boost = options.boost ?? 4;
        this.keys = {
            forward: options.keys?.forward ?? ["KeyW", "ArrowUp"],
            back: options.keys?.back ?? ["KeyS", "ArrowDown"],
            left: options.keys?.left ?? ["KeyA", "ArrowLeft"],
            right: options.keys?.right ?? ["KeyD", "ArrowRight"],
            boost: options.keys?.boost ?? ["ShiftLeft", "ShiftRight"],
        };
    }
    listen(element) {
        element.addEventListener("pointerdown", this.onPointerDown);
        element.addEventListener("wheel", this.onWheel, { passive: true });
        window.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("pointerup", this.onPointerUp);
        window.addEventListener("pointercancel", this.onPointerUp);
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
    }
    unlisten(element) {
        element.removeEventListener("pointerdown", this.onPointerDown);
        element.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("pointermove", this.onPointerMove);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointercancel", this.onPointerUp);
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onBlur);
        this.pointer = -1;
        this.held.clear();
    }
    onDetached(_detached) {
        this.held.clear();
    }
    fly(seconds) {
        const { forward, right, step, keys } = this;
        const along = this.pressed(keys.forward) - this.pressed(keys.back);
        const across = this.pressed(keys.right) - this.pressed(keys.left);
        if (along === 0 && across === 0) {
            return;
        }
        this.getWorldDirection(forward);
        right.set(1, 0, 0).applyQuaternion(this.quaternion);
        step.set(0, 0, 0).addScaledVector(forward, along).addScaledVector(right, across).normalize();
        this.position.addScaledVector(step, this.flySpeed * (this.pressed(keys.boost) ? this.boost : 1) * seconds);
    }
    pressed(codes) {
        for (const code of codes) {
            if (this.held.has(code)) {
                return 1;
            }
        }
        return 0;
    }
}
