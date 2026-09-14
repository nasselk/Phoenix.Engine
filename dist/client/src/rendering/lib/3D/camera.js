import { PerspectiveCamera, Vector3 } from "three";
import { clamp } from "../../../../../shared/libs/math/utils";
const FLY_KEYS = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD" };
const WORLD_UP = new Vector3(0, 1, 0);
const MAX_FRAME = 0.1;
export class OrbitCamera extends PerspectiveCamera {
    constructor(options = {}) {
        super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);
        this.pointer = -1;
        this.free = false;
        this.held = new Set();
        this.lastUpdate = 0;
        this.forward = new Vector3();
        this.right = new Vector3();
        this.step = new Vector3();
        this.onPointerDown = (event) => {
            if (this.dragging && event.button === this.button) {
                this.pointer = event.pointerId;
            }
        };
        this.onPointerMove = (event) => {
            if (!this.dragging || event.pointerId !== this.pointer) {
                return;
            }
            if (this.free) {
                const speed = this.rotateSpeed / this.zoom;
                this.rotateOnWorldAxis(WORLD_UP, -event.movementX * speed);
                this.rotateX(-event.movementY * speed);
                return;
            }
            this.rotate(-event.movementX * this.rotateSpeed, event.movementY * this.rotateSpeed);
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
        this.onPointerUp = (event) => {
            if (event.pointerId === this.pointer) {
                this.pointer = -1;
            }
        };
        this.onWheel = (event) => {
            if (!this.zooming) {
                return;
            }
            if (this.free) {
                this.setZoom(this.zoom * Math.exp(-event.deltaY * this.zoomSpeed));
            }
            else {
                this.zoomBy(event.deltaY * this.zoomSpeed);
            }
        };
        this.yaw = options.yaw ?? 0;
        this.pitch = options.pitch ?? 0.6;
        this.distance = options.distance ?? 14;
        this.minPitch = options.minPitch ?? 0.1;
        this.maxPitch = options.maxPitch ?? 1.45;
        this.minDistance = options.minDistance ?? 4;
        this.maxDistance = options.maxDistance ?? 40;
        this.rotateSpeed = options.rotateSpeed ?? 0.0025;
        this.zoomSpeed = options.zoomSpeed ?? 0.001;
        this.dragging = options.dragging ?? true;
        this.zooming = options.zooming ?? true;
        this.button = options.button ?? 0;
        this.flySpeed = options.flySpeed ?? 20;
        this.boost = options.boost ?? 4;
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 10;
    }
    get detached() {
        return this.free;
    }
    setDetached(detached) {
        this.free = detached;
        this.held.clear();
        if (!detached && this.zoom !== 1) {
            this.zoom = 1;
            this.updateProjectionMatrix();
        }
        return this;
    }
    setZoom(zoom) {
        this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.updateProjectionMatrix();
        return this;
    }
    toggleDetached() {
        return this.setDetached(!this.free);
    }
    get isOrbiting() {
        return this.pointer !== -1;
    }
    rotate(yaw, pitch) {
        this.yaw += yaw;
        this.pitch = clamp(this.pitch + pitch, this.minPitch, this.maxPitch);
        return this;
    }
    zoomBy(amount) {
        this.distance = clamp(this.distance * Math.exp(amount), this.minDistance, this.maxDistance);
        return this;
    }
    connect(element = window) {
        this.destroy();
        this.element = element;
        element.addEventListener("pointerdown", this.onPointerDown);
        element.addEventListener("wheel", this.onWheel, { passive: true });
        window.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("pointerup", this.onPointerUp);
        window.addEventListener("pointercancel", this.onPointerUp);
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
        return this;
    }
    destroy() {
        const element = this.element;
        if (element === undefined) {
            return this;
        }
        element.removeEventListener("pointerdown", this.onPointerDown);
        element.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("pointermove", this.onPointerMove);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointercancel", this.onPointerUp);
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onBlur);
        this.element = undefined;
        this.pointer = -1;
        this.held.clear();
        return this;
    }
    update() {
        const now = performance.now();
        const seconds = this.lastUpdate === 0 ? 0 : Math.min((now - this.lastUpdate) / 1000, MAX_FRAME);
        this.lastUpdate = now;
        if (this.free) {
            return this.fly(seconds);
        }
        const target = this.target;
        if (target === undefined) {
            return this;
        }
        const flat = Math.cos(this.pitch) * this.distance;
        const { x, y, z } = target;
        this.position.set(x + Math.sin(this.yaw) * flat, y + Math.sin(this.pitch) * this.distance, z + Math.cos(this.yaw) * flat);
        this.lookAt(x, y, z);
        return this;
    }
    fly(seconds) {
        const { held, forward, right, step } = this;
        const along = (held.has(FLY_KEYS.forward) ? 1 : 0) - (held.has(FLY_KEYS.back) ? 1 : 0);
        const across = (held.has(FLY_KEYS.right) ? 1 : 0) - (held.has(FLY_KEYS.left) ? 1 : 0);
        if (along === 0 && across === 0) {
            return this;
        }
        this.getWorldDirection(forward);
        right.set(1, 0, 0).applyQuaternion(this.quaternion);
        step.set(0, 0, 0).addScaledVector(forward, along).addScaledVector(right, across).normalize();
        const speed = this.flySpeed * (held.has("ShiftLeft") || held.has("ShiftRight") ? this.boost : 1);
        this.position.addScaledVector(step, speed * seconds);
        return this;
    }
}
