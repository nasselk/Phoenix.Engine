import { PerspectiveCamera, Vector3 } from "three";
import { normalizeAnglePI } from "../../../shared/math/angle";
import { clamp } from "../../../shared/math/utils";
const MAX_FRAME = 0.1;
const OFFSET = new Vector3();
const EYE = new Vector3();
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const UP = new Vector3();
const STEP = new Vector3();
export class Camera extends PerspectiveCamera {
    constructor(options = {}) {
        super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);
        this.anchor = new Vector3();
        this.turn = 0;
        this.tilt = 0;
        this.flyForward = 0;
        this.flyRight = 0;
        this.flyBoost = false;
        this.turnPointer = -1;
        this.panPointer = -1;
        this.touches = new Map();
        this.spread = 0;
        this.middle = { x: 0, y: 0 };
        this.swing = { duration: 0, elapsed: 0, fromYaw: 0, toYaw: 0, fromPitch: 0, toPitch: 0 };
        this.onPointerDown = (event) => {
            if (event.pointerType === "mouse") {
                if (this.dragging && event.button === this.turnButton) {
                    this.turnPointer = event.pointerId;
                }
                else if (this.panning && event.button === this.panButton) {
                    this.panPointer = event.pointerId;
                }
                return;
            }
            if (this.touches.size >= 2) {
                return;
            }
            this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
            this.measureFingers();
            try {
                event.currentTarget?.setPointerCapture?.(event.pointerId);
            }
            catch { }
        };
        this.onPointerMove = (event) => {
            if (event.pointerId === this.turnPointer) {
                this.drag(event.movementX, event.movementY);
            }
            if (event.pointerId === this.panPointer) {
                this.pan(event.movementX, event.movementY);
            }
            const touch = this.touches.get(event.pointerId);
            if (touch === undefined) {
                return;
            }
            const x = event.clientX - touch.x;
            const y = event.clientY - touch.y;
            touch.x = event.clientX;
            touch.y = event.clientY;
            if (this.touches.size === 1) {
                this.drag(x * this.touchRotateScale, y * this.touchRotateScale);
                return;
            }
            const spread = this.apart();
            if (this.spread > 0 && spread > 0) {
                this.pinchBy((spread / this.spread) ** this.pinchSpeed);
            }
            this.spread = spread;
            const { middle } = this;
            const fromX = middle.x;
            const fromY = middle.y;
            this.center();
            this.pan(middle.x - fromX, middle.y - fromY);
        };
        this.onPointerUp = (event) => {
            if (event.pointerId === this.turnPointer) {
                this.turnPointer = -1;
            }
            if (event.pointerId === this.panPointer) {
                this.panPointer = -1;
            }
            if (this.touches.delete(event.pointerId)) {
                this.measureFingers();
            }
        };
        this.onWheel = (event) => {
            if (this.zooming) {
                this.zoomBy(event.deltaY * this.zoomSpeed);
            }
        };
        this.verticalFovDegrees = this.fov;
        this.minHorizontalFovDegrees = options.minHorizontalFov ?? 60;
        this.yaw = options.yaw ?? 0;
        this.pitch = options.pitch ?? 0.6;
        this.distance = options.distance ?? 14;
        this.minPitch = options.minPitch ?? 0.1;
        this.maxPitch = options.maxPitch ?? 1.45;
        this.minDistance = options.minDistance ?? 4;
        this.maxDistance = options.maxDistance ?? 40;
        this.turnsAbout = options.turnsAbout ?? "anchor";
        this.zoomMode = options.zoomMode ?? "distance";
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 10;
        this.rotateSpeed = options.rotateSpeed ?? 0.0025;
        this.touchRotateScale = options.touchRotateScale ?? 2;
        this.turnSpeed = options.turnSpeed ?? 2.5;
        this.tiltSpeed = options.tiltSpeed ?? 1.5;
        this.zoomSpeed = options.zoomSpeed ?? 0.001;
        this.pinchSpeed = options.pinchSpeed ?? 1;
        this.panSpeed = options.panSpeed ?? 0.03;
        this.flySpeed = options.flySpeed ?? 20;
        this.boost = options.boost ?? 4;
        this.dragging = options.dragging ?? true;
        this.zooming = options.zooming ?? true;
        this.panning = options.panning ?? false;
        this.turnButton = options.turnButton ?? 0;
        this.panButton = options.panButton ?? 2;
        this.place();
    }
    get isOrbiting() {
        return this.turnPointer !== -1 || this.touches.size > 0;
    }
    fit(aspect = this.aspect) {
        const narrowest = this.minHorizontalFovDegrees;
        const needed = narrowest > 0 ? 2 * Math.atan(Math.tan((narrowest * Math.PI) / 360) / aspect) * (180 / Math.PI) : 0;
        this.aspect = aspect;
        this.fov = Math.max(this.verticalFovDegrees, needed);
        this.updateProjectionMatrix();
        return this;
    }
    get verticalFov() {
        return this.verticalFovDegrees;
    }
    set verticalFov(degrees) {
        this.verticalFovDegrees = degrees;
        this.fit();
    }
    get minHorizontalFov() {
        return this.minHorizontalFovDegrees;
    }
    set minHorizontalFov(degrees) {
        this.minHorizontalFovDegrees = degrees;
        this.fit();
    }
    rotate(yaw, pitch) {
        this.yaw += yaw;
        this.pitch = clamp(this.pitch + pitch, this.minPitch, this.maxPitch);
        return this.place();
    }
    orbit(yaw, pitch) {
        this.swing.duration = 0;
        return this.rotate(yaw, pitch);
    }
    lookFrom(direction, seconds = 0) {
        const { swing } = this;
        swing.fromYaw = this.yaw;
        swing.fromPitch = this.pitch;
        swing.toYaw = direction.x === 0 && direction.z === 0 ? this.yaw : this.yaw + normalizeAnglePI(Math.atan2(direction.x, direction.z) - this.yaw);
        swing.toPitch = clamp(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), this.minPitch, this.maxPitch);
        swing.elapsed = 0;
        swing.duration = seconds;
        if (seconds <= 0) {
            this.yaw = swing.toYaw;
            this.pitch = swing.toPitch;
        }
        return this.place();
    }
    zoomBy(amount) {
        if (this.zoomMode === "lens") {
            return this.setZoom(this.zoom * Math.exp(-amount));
        }
        this.distance = clamp(this.distance * Math.exp(amount), this.minDistance, this.maxDistance);
        return this.place();
    }
    pinchBy(ratio) {
        if (!this.zooming || ratio <= 0) {
            return this;
        }
        return this.zoomBy(-Math.log(ratio));
    }
    setZoom(zoom) {
        this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.updateProjectionMatrix();
        return this;
    }
    startFrom(camera) {
        camera.getWorldDirection(FORWARD);
        if (camera instanceof Camera) {
            this.yaw = camera.yaw;
            this.pitch = clamp(camera.pitch, this.minPitch, this.maxPitch);
            this.minHorizontalFov = camera.minHorizontalFov;
            this.verticalFov = camera.verticalFov;
        }
        else {
            this.yaw = Math.atan2(-FORWARD.x, -FORWARD.z);
            this.pitch = clamp(Math.asin(clamp(-FORWARD.y, -1, 1)), this.minPitch, this.maxPitch);
            this.verticalFov = camera.fov;
        }
        this.anchor.copy(camera.position).addScaledVector(FORWARD, this.distance);
        this.near = camera.near;
        this.far = camera.far;
        this.zoom = 1;
        this.swing.duration = 0;
        this.fit(camera.aspect);
        return this.place();
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
        this.touches.clear();
        this.spread = 0;
        return this;
    }
    update(deltaTime = 0) {
        const seconds = Math.min(deltaTime, MAX_FRAME);
        const { swing, target } = this;
        if (swing.duration > 0) {
            swing.elapsed = Math.min(swing.elapsed + seconds, swing.duration);
            if (swing.elapsed === swing.duration) {
                this.yaw = swing.toYaw;
                this.pitch = swing.toPitch;
                swing.duration = 0;
            }
            else {
                const eased = ease(swing.elapsed / swing.duration);
                this.yaw = swing.fromYaw + (swing.toYaw - swing.fromYaw) * eased;
                this.pitch = swing.fromPitch + (swing.toPitch - swing.fromPitch) * eased;
            }
        }
        if (target !== undefined) {
            this.anchor.set(target.x, target.y, target.z);
        }
        if (this.turn !== 0 || this.tilt !== 0) {
            this.look(-this.turn * this.turnSpeed * seconds, -this.tilt * this.tiltSpeed * seconds);
        }
        if (target === undefined && (this.flyForward !== 0 || this.flyRight !== 0)) {
            this.facing(FORWARD);
            this.screenRight(RIGHT);
            STEP.set(0, 0, 0).addScaledVector(FORWARD, this.flyForward).addScaledVector(RIGHT, this.flyRight);
            if (STEP.lengthSq() > 1) {
                STEP.normalize();
            }
            this.anchor.addScaledVector(STEP, this.flySpeed * (this.flyBoost ? this.boost : 1) * seconds);
        }
        return this.place();
    }
    look(yaw, pitch) {
        if (this.turnsAbout === "anchor" || this.target !== undefined) {
            this.rotate(yaw, pitch);
            return;
        }
        EYE.copy(this.anchor).add(this.offset(OFFSET));
        this.rotate(yaw, pitch);
        this.anchor.copy(EYE).sub(this.offset(OFFSET));
        this.place();
    }
    drag(x, y) {
        if (!this.dragging) {
            return;
        }
        const speed = this.rotateSpeed / this.zoom;
        this.swing.duration = 0;
        this.look(-x * speed, y * speed);
    }
    pan(x, y) {
        if (!this.panning || this.target !== undefined) {
            return;
        }
        const speed = this.panSpeed / this.zoom;
        this.swing.duration = 0;
        this.anchor.addScaledVector(this.screenRight(RIGHT), -x * speed).addScaledVector(this.screenUp(UP), y * speed);
        this.place();
    }
    place() {
        this.position.copy(this.anchor).add(this.offset(OFFSET));
        this.rotation.set(-this.pitch, this.yaw, 0, "YXZ");
        return this;
    }
    offset(out) {
        const flat = Math.cos(this.pitch) * this.distance;
        return out.set(Math.sin(this.yaw) * flat, Math.sin(this.pitch) * this.distance, Math.cos(this.yaw) * flat);
    }
    facing(out) {
        const flat = Math.cos(this.pitch);
        return out.set(-Math.sin(this.yaw) * flat, -Math.sin(this.pitch), -Math.cos(this.yaw) * flat);
    }
    screenRight(out) {
        return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    }
    screenUp(out) {
        const lift = Math.sin(this.pitch);
        return out.set(-Math.sin(this.yaw) * lift, Math.cos(this.pitch), -Math.cos(this.yaw) * lift);
    }
    measureFingers() {
        this.spread = this.apart();
        this.center();
    }
    apart() {
        if (this.touches.size !== 2) {
            return 0;
        }
        const [first, second] = [...this.touches.values()];
        return Math.hypot(second.x - first.x, second.y - first.y);
    }
    center() {
        const { middle } = this;
        middle.x = middle.y = 0;
        for (const touch of this.touches.values()) {
            middle.x += touch.x / this.touches.size;
            middle.y += touch.y / this.touches.size;
        }
    }
}
export function ease(progress) {
    return progress * progress * (3 - 2 * progress);
}
//# sourceMappingURL=Camera.js.map