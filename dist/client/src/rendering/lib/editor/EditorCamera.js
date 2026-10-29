import { Matrix4, Quaternion, Vector3 } from "three";
import { clamp } from "../../../../../shared/math/utils";
import { ControlledCamera, ease } from "../camera/ControlledCamera";
const WORLD_UP = new Vector3(0, 1, 0);
const ORIGIN = new Vector3();
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const STEP = new Vector3();
const SIDE = new Vector3();
const LOOK = new Matrix4();
const TURN = new Quaternion();
export class EditorCamera extends ControlledCamera {
    constructor(options = {}) {
        super(options);
        this.flyForward = 0;
        this.flyRight = 0;
        this.flyBoost = false;
        this.turnPointer = -1;
        this.panPointer = -1;
        this.swing = { duration: 0, elapsed: 0, pivot: new Vector3(), from: new Quaternion(), to: new Quaternion() };
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
        this.flySpeed = options.flySpeed ?? 20;
        this.boost = options.boost ?? 4;
        this.panSpeed = options.panSpeed ?? 0.03;
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = options.maxZoom ?? 10;
        this.distance = options.distance ?? 14;
        this.turnButton = options.turnButton ?? 2;
        this.panButton = options.panButton ?? 0;
    }
    startFrom(camera) {
        this.position.copy(camera.position);
        this.quaternion.copy(camera.quaternion);
        this.near = camera.near;
        this.far = camera.far;
        this.zoom = 1;
        this.swing.duration = 0;
        if (camera instanceof ControlledCamera) {
            this.minHorizontalFov = camera.minHorizontalFov;
            this.verticalFov = camera.verticalFov;
        }
        else {
            this.verticalFov = camera.fov;
        }
        return this.fit(camera.aspect);
    }
    setZoom(zoom) {
        this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
        this.updateProjectionMatrix();
        return this;
    }
    orbit(yaw, pitch) {
        this.swing.duration = 0;
        this.ahead(SIDE);
        this.quaternion.premultiply(TURN.setFromAxisAngle(WORLD_UP, yaw));
        this.rotateX(-pitch);
        this.around(SIDE);
        return this;
    }
    lookFrom(direction, seconds = 0) {
        const { swing } = this;
        const side = SIDE.copy(direction).normalize();
        this.ahead(swing.pivot);
        swing.from.copy(this.quaternion);
        const vertical = side.x === 0 && side.z === 0;
        swing.to.setFromRotationMatrix(LOOK.lookAt(side, ORIGIN, vertical ? STEP.set(0, 0, side.y > 0 ? -1 : 1) : WORLD_UP));
        swing.elapsed = 0;
        swing.duration = seconds;
        if (seconds <= 0) {
            this.quaternion.copy(swing.to);
            this.around(swing.pivot);
        }
        return this;
    }
    step(seconds) {
        const { swing } = this;
        if (swing.duration > 0) {
            swing.elapsed = Math.min(swing.elapsed + seconds, swing.duration);
            this.quaternion.slerpQuaternions(swing.from, swing.to, ease(swing.elapsed / swing.duration));
            this.around(swing.pivot);
            if (swing.elapsed === swing.duration) {
                swing.duration = 0;
            }
        }
        if (this.turn !== 0 || this.tilt !== 0) {
            this.rotateOnWorldAxis(WORLD_UP, -this.turn * this.turnSpeed * seconds);
            this.rotateX(this.tilt * this.tiltSpeed * seconds);
        }
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
        this.turnPointer = this.panPointer = -1;
    }
    ahead(target) {
        return this.getWorldDirection(target).multiplyScalar(this.distance).add(this.position);
    }
    around(pivot) {
        this.position.copy(pivot).addScaledVector(STEP.set(0, 0, 1).applyQuaternion(this.quaternion), this.distance);
    }
    drag(x, y) {
        const speed = this.rotateSpeed / this.zoom;
        this.swing.duration = 0;
        this.rotateOnWorldAxis(WORLD_UP, -x * speed);
        this.rotateX(-y * speed);
    }
    pan(x, y) {
        const speed = this.panSpeed / this.zoom;
        this.swing.duration = 0;
        RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
        STEP.set(0, 1, 0).applyQuaternion(this.quaternion);
        this.position.addScaledVector(RIGHT, -x * speed).addScaledVector(STEP, y * speed);
    }
}
//# sourceMappingURL=EditorCamera.js.map