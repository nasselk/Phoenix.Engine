import { PerspectiveCamera } from "three";
const MAX_FRAME = 0.1;
export class ControlledCamera extends PerspectiveCamera {
    constructor(options = {}) {
        super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);
        this.turn = 0;
        this.tilt = 0;
        this.verticalFovDegrees = this.fov;
        this.minHorizontalFovDegrees = options.minHorizontalFov ?? 60;
        this.rotateSpeed = options.rotateSpeed ?? 0.0025;
        this.turnSpeed = options.turnSpeed ?? 2.5;
        this.tiltSpeed = options.tiltSpeed ?? 1.5;
        this.zoomSpeed = options.zoomSpeed ?? 0.001;
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
        return this;
    }
    update(deltaTime = 0) {
        this.step(Math.min(deltaTime, MAX_FRAME));
        return this;
    }
}
export function ease(progress) {
    return progress * progress * (3 - 2 * progress);
}
//# sourceMappingURL=ControlledCamera.js.map