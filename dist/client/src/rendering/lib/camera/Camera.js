import { normalizeAnglePI } from "../../../../../shared/math/angle";
import { clamp } from "../../../../../shared/math/utils";
import { ControlledCamera, ease } from "./ControlledCamera";
export class OrbitCamera extends ControlledCamera {
    constructor(options = {}) {
        super(options);
        this.orbiting = false;
        this.swing = { duration: 0, elapsed: 0, fromYaw: 0, toYaw: 0, fromPitch: 0, toPitch: 0 };
        this.yaw = options.yaw ?? 0;
        this.pitch = options.pitch ?? 0.6;
        this.distance = options.distance ?? 14;
        this.minPitch = options.minPitch ?? 0.1;
        this.maxPitch = options.maxPitch ?? 1.45;
        this.minDistance = options.minDistance ?? 4;
        this.maxDistance = options.maxDistance ?? 40;
        this.dragging = options.dragging ?? true;
        this.zooming = options.zooming ?? true;
    }
    get isOrbiting() {
        return this.orbiting;
    }
    rotate(yaw, pitch) {
        this.yaw += yaw;
        this.pitch = clamp(this.pitch + pitch, this.minPitch, this.maxPitch);
        return this;
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
        return this.zoomBy(-Math.log(ratio));
    }
    destroy() {
        super.destroy();
        this.orbiting = false;
        return this;
    }
    step(seconds) {
        const { swing } = this;
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
        const target = this.target;
        if (target === undefined) {
            return;
        }
        if (this.turn !== 0 || this.tilt !== 0) {
            this.rotate(-this.turn * this.turnSpeed * seconds, -this.tilt * this.tiltSpeed * seconds);
        }
        const flat = Math.cos(this.pitch) * this.distance;
        const { x, y, z } = target;
        this.position.set(x + Math.sin(this.yaw) * flat, y + Math.sin(this.pitch) * this.distance, z + Math.cos(this.yaw) * flat);
        this.lookAt(x, y, z);
    }
    drag(x, y) {
        if (!this.dragging) {
            return;
        }
        this.orbit(-x * this.rotateSpeed, y * this.rotateSpeed);
    }
    zoomByDelta(delta) {
        if (!this.zooming) {
            return;
        }
        this.zoomBy(delta * this.zoomSpeed);
    }
}
//# sourceMappingURL=Camera.js.map