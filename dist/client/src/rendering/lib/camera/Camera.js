import { PerspectiveCamera, Vector3 } from "three";
import { clamp } from "../../../../../shared/math/utils";
const WORLD_UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const STEP = new Vector3();
const MAX_FRAME = 0.1;
export class OrbitCamera extends PerspectiveCamera {
    constructor(options = {}) {
        super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);
        this.turn = 0;
        this.tilt = 0;
        this.flyForward = 0;
        this.flyRight = 0;
        this.flyBoost = false;
        this.orbiting = false;
        this.free = false;
        this.verticalFovDegrees = this.fov;
        this.minHorizontalFovDegrees = options.minHorizontalFov ?? 60;
        this.yaw = options.yaw ?? 0;
        this.pitch = options.pitch ?? 0.6;
        this.distance = options.distance ?? 14;
        this.minPitch = options.minPitch ?? 0.1;
        this.maxPitch = options.maxPitch ?? 1.45;
        this.minDistance = options.minDistance ?? 4;
        this.maxDistance = options.maxDistance ?? 40;
        this.rotateSpeed = options.rotateSpeed ?? 0.0025;
        this.turnSpeed = options.turnSpeed ?? 2.5;
        this.tiltSpeed = options.tiltSpeed ?? 1.5;
        this.flySpeed = options.flySpeed ?? 20;
        this.boost = options.boost ?? 4;
        this.zoomSpeed = options.zoomSpeed ?? 0.001;
        this.dragging = options.dragging ?? true;
        this.zooming = options.zooming ?? true;
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 10;
    }
    get detached() {
        return this.free;
    }
    set detached(detached) {
        this.free = detached;
        if (!detached && this.zoom !== 1) {
            this.zoom = 1;
            this.updateProjectionMatrix();
        }
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
    setZoom(zoom) {
        this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.updateProjectionMatrix();
        return this;
    }
    get isOrbiting() {
        return this.orbiting;
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
    pinchBy(ratio) {
        if (!this.zooming || ratio <= 0) {
            return this;
        }
        return this.free ? this.setZoom(this.zoom * ratio) : this.zoomBy(-Math.log(ratio));
    }
    connect(element = window) {
        this.destroy();
        this.element = element;
        this.listen(element);
        return this;
    }
    destroy() {
        const element = this.element;
        if (element === undefined) {
            return this;
        }
        this.unlisten(element);
        this.element = undefined;
        this.orbiting = false;
        return this;
    }
    update(deltaTime = 0) {
        const seconds = Math.min(deltaTime, MAX_FRAME);
        if (this.free) {
            if (this.turn !== 0 || this.tilt !== 0) {
                this.rotateOnWorldAxis(WORLD_UP, -this.turn * this.turnSpeed * seconds);
                this.rotateX(this.tilt * this.tiltSpeed * seconds);
            }
            this.fly(seconds);
            return this;
        }
        const target = this.target;
        if (target === undefined) {
            return this;
        }
        if (this.turn !== 0 || this.tilt !== 0) {
            this.rotate(-this.turn * this.turnSpeed * seconds, -this.tilt * this.tiltSpeed * seconds);
        }
        const flat = Math.cos(this.pitch) * this.distance;
        const { x, y, z } = target;
        this.position.set(x + Math.sin(this.yaw) * flat, y + Math.sin(this.pitch) * this.distance, z + Math.cos(this.yaw) * flat);
        this.lookAt(x, y, z);
        return this;
    }
    fly(seconds) {
        const along = this.flyForward;
        const across = this.flyRight;
        if (along === 0 && across === 0) {
            return;
        }
        this.getWorldDirection(FORWARD);
        RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
        STEP.set(0, 0, 0).addScaledVector(FORWARD, along).addScaledVector(RIGHT, across);
        if (STEP.lengthSq() > 1) {
            STEP.normalize();
        }
        this.position.addScaledVector(STEP, this.flySpeed * (this.flyBoost ? this.boost : 1) * seconds);
    }
    drag(x, y) {
        if (!this.dragging) {
            return;
        }
        if (this.free) {
            const speed = this.rotateSpeed / this.zoom;
            this.rotateOnWorldAxis(WORLD_UP, -x * speed);
            this.rotateX(-y * speed);
            return;
        }
        this.rotate(-x * this.rotateSpeed, y * this.rotateSpeed);
    }
    zoomByDelta(delta) {
        if (!this.zooming) {
            return;
        }
        if (this.free) {
            this.setZoom(this.zoom * Math.exp(-delta * this.zoomSpeed));
        }
        else {
            this.zoomBy(delta * this.zoomSpeed);
        }
    }
}
