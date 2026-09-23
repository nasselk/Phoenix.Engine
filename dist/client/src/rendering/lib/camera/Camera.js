import { PerspectiveCamera, Vector3 } from "three";
import { clamp } from "../../../../../shared/libs/math/utils";
const WORLD_UP = new Vector3(0, 1, 0);
const MAX_FRAME = 0.1;
export class OrbitCamera extends PerspectiveCamera {
    constructor(options = {}) {
        super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);
        this.orbiting = false;
        this.free = false;
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
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 10;
    }
    get detached() {
        return this.free;
    }
    setDetached(detached) {
        this.free = detached;
        this.onDetached(detached);
        if (!detached && this.zoom !== 1) {
            this.zoom = 1;
            this.updateProjectionMatrix();
        }
        return this;
    }
    detach() {
        return this.setDetached(true);
    }
    reattach() {
        return this.setDetached(false);
    }
    toggleDetached() {
        return this.setDetached(!this.free);
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
        if (this.free) {
            this.fly(Math.min(deltaTime, MAX_FRAME));
            return this;
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
    fly(_seconds) { }
    onDetached(_detached) { }
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
