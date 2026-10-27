import { PerspectiveCamera, Vector3 } from "three";
import { clamp } from "../../../../../shared/math/utils";
const WORLD_UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const STEP = new Vector3();
const MAX_FRAME = 0.1;
export class EditorCamera extends PerspectiveCamera {
    constructor(options = {}) {
        super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);
        this.turn = 0;
        this.tilt = 0;
        this.flyForward = 0;
        this.flyRight = 0;
        this.flyBoost = false;
        this.turnPointer = -1;
        this.panPointer = -1;
        this.onPointerDown = (event) => {
            if (event.button === this.turnButton) {
                this.turnPointer = event.pointerId;
            }
            else if (event.button === this.panButton) {
                this.panPointer = event.pointerId;
            }
        };
        this.onPointerMove = (event) => {
            if (event.pointerId === this.turnPointer) {
                this.drag(event.movementX, event.movementY);
            }
            if (event.pointerId === this.panPointer) {
                this.pan(event.movementX, event.movementY);
            }
        };
        this.onPointerUp = (event) => {
            if (event.pointerId === this.turnPointer) {
                this.turnPointer = -1;
            }
            if (event.pointerId === this.panPointer) {
                this.panPointer = -1;
            }
        };
        this.onWheel = (event) => {
            this.setZoom(this.zoom * Math.exp(-event.deltaY * this.zoomSpeed));
        };
        this.rotateSpeed = options.rotateSpeed ?? 0.0025;
        this.turnSpeed = options.turnSpeed ?? 2.5;
        this.tiltSpeed = options.tiltSpeed ?? 1.5;
        this.flySpeed = options.flySpeed ?? 20;
        this.boost = options.boost ?? 4;
        this.panSpeed = options.panSpeed ?? 0.03;
        this.zoomSpeed = options.zoomSpeed ?? 0.001;
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 10;
        this.distance = options.distance ?? 14;
        this.turnButton = options.turnButton ?? 2;
        this.panButton = options.panButton ?? 0;
    }
    startFrom(camera) {
        this.position.copy(camera.position);
        this.quaternion.copy(camera.quaternion);
        this.fov = camera.fov;
        this.near = camera.near;
        this.far = camera.far;
        this.aspect = camera.aspect;
        this.zoom = 1;
        this.updateProjectionMatrix();
        return this;
    }
    fit(aspect = this.aspect) {
        this.aspect = aspect;
        this.updateProjectionMatrix();
        return this;
    }
    setZoom(zoom) {
        this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.updateProjectionMatrix();
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
        this.element = undefined;
        this.turnPointer = this.panPointer = -1;
        return this;
    }
    update(deltaTime = 0) {
        const seconds = Math.min(deltaTime, MAX_FRAME);
        if (this.turn !== 0 || this.tilt !== 0) {
            this.rotateOnWorldAxis(WORLD_UP, -this.turn * this.turnSpeed * seconds);
            this.rotateX(this.tilt * this.tiltSpeed * seconds);
        }
        const along = this.flyForward;
        const across = this.flyRight;
        if (along === 0 && across === 0) {
            return this;
        }
        this.getWorldDirection(FORWARD);
        RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
        STEP.set(0, 0, 0).addScaledVector(FORWARD, along).addScaledVector(RIGHT, across);
        if (STEP.lengthSq() > 1) {
            STEP.normalize();
        }
        this.position.addScaledVector(STEP, this.flySpeed * (this.flyBoost ? this.boost : 1) * seconds);
        return this;
    }
    drag(x, y) {
        const speed = this.rotateSpeed / this.zoom;
        this.rotateOnWorldAxis(WORLD_UP, -x * speed);
        this.rotateX(-y * speed);
    }
    pan(x, y) {
        const speed = this.panSpeed / this.zoom;
        RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
        STEP.set(0, 1, 0).applyQuaternion(this.quaternion);
        this.position.addScaledVector(RIGHT, -x * speed).addScaledVector(STEP, y * speed);
    }
}
//# sourceMappingURL=EditorCamera.js.map