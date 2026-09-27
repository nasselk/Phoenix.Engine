const SMALLEST_RANGE = Math.SQRT1_2;
const COMPONENT_BITS = 10;
const COMPONENT_MASK = (1 << COMPONENT_BITS) - 1;
const COMPONENT_STEPS = (1 << (COMPONENT_BITS - 1)) - 1;
const SLERP_THRESHOLD = 1e-4;
export function eulerToQuaternion(pitch, yaw, roll, out) {
    const c1 = Math.cos(pitch / 2);
    const c2 = Math.cos(yaw / 2);
    const c3 = Math.cos(roll / 2);
    const s1 = Math.sin(pitch / 2);
    const s2 = Math.sin(yaw / 2);
    const s3 = Math.sin(roll / 2);
    out.x = s1 * c2 * c3 + c1 * s2 * s3;
    out.y = c1 * s2 * c3 - s1 * c2 * s3;
    out.z = c1 * c2 * s3 - s1 * s2 * c3;
    out.w = c1 * c2 * c3 + s1 * s2 * s3;
    return out;
}
export function quaternionToEuler({ x, y, z, w }, out) {
    const m11 = 1 - 2 * (y * y + z * z);
    const m13 = 2 * (x * z + w * y);
    const m21 = 2 * (x * y + w * z);
    const m22 = 1 - 2 * (x * x + z * z);
    const m23 = 2 * (y * z - w * x);
    const m31 = 2 * (x * z - w * y);
    const m33 = 1 - 2 * (x * x + y * y);
    out[0] = Math.asin(-Math.max(-1, Math.min(1, m23)));
    if (Math.abs(m23) < 0.9999999) {
        out[1] = Math.atan2(m13, m33);
        out[2] = Math.atan2(m21, m22);
    }
    else {
        out[1] = Math.atan2(-m31, m11);
        out[2] = 0;
    }
    return out;
}
class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
    set(a, y, z, w) {
        if (typeof a === "object") {
            this.x = a.x;
            this.y = a.y;
            this.z = a.z;
            this.w = a.w;
        }
        else {
            this.x = a;
            this.y = y;
            this.z = z;
            this.w = w;
        }
        return this;
    }
    setFromEuler(pitch, yaw, roll) {
        return eulerToQuaternion(pitch, yaw, roll, this);
    }
    setFromYaw(yaw) {
        return this.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
    }
    setFromAxisAngle(axis, angle) {
        const sin = Math.sin(angle / 2);
        return this.set(axis.x * sin, axis.y * sin, axis.z * sin, Math.cos(angle / 2));
    }
    toEuler(out = [0, 0, 0]) {
        return quaternionToEuler(this, out);
    }
    get yaw() {
        const { x, y, z, w } = this;
        return Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
    }
    dot(quaternion) {
        return this.x * quaternion.x + this.y * quaternion.y + this.z * quaternion.z + this.w * quaternion.w;
    }
    angleTo(quaternion) {
        return 2 * Math.acos(Math.min(1, Math.abs(this.dot(quaternion))));
    }
    equals(quaternion, epsilon = 0) {
        return this.angleTo(quaternion) <= epsilon;
    }
    length() {
        return Math.hypot(this.x, this.y, this.z, this.w);
    }
    normalize() {
        const length = this.length();
        if (length === 0) {
            return this.set(0, 0, 0, 1);
        }
        this.x /= length;
        this.y /= length;
        this.z /= length;
        this.w /= length;
        return this;
    }
    invert() {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
        return this;
    }
    multiply(quaternion) {
        const { x: ax, y: ay, z: az, w: aw } = this;
        const { x: bx, y: by, z: bz, w: bw } = quaternion;
        this.x = ax * bw + aw * bx + ay * bz - az * by;
        this.y = ay * bw + aw * by + az * bx - ax * bz;
        this.z = az * bw + aw * bz + ax * by - ay * bx;
        this.w = aw * bw - ax * bx - ay * by - az * bz;
        return this;
    }
    premultiply(quaternion) {
        const { x: ax, y: ay, z: az, w: aw } = quaternion;
        const { x: bx, y: by, z: bz, w: bw } = this;
        this.x = ax * bw + aw * bx + ay * bz - az * by;
        this.y = ay * bw + aw * by + az * bx - ax * bz;
        this.z = az * bw + aw * bz + ax * by - ay * bx;
        this.w = aw * bw - ax * bx - ay * by - az * bz;
        return this;
    }
    slerp(target, t) {
        let { x, y, z, w } = target;
        let cos = this.dot(target);
        if (cos < 0) {
            x = -x;
            y = -y;
            z = -z;
            w = -w;
            cos = -cos;
        }
        let from = 1 - t;
        let to = t;
        if (1 - cos > SLERP_THRESHOLD) {
            const angle = Math.acos(cos);
            const sin = Math.sin(angle);
            from = Math.sin(from * angle) / sin;
            to = Math.sin(to * angle) / sin;
        }
        this.x = this.x * from + x * to;
        this.y = this.y * from + y * to;
        this.z = this.z * from + z * to;
        this.w = this.w * from + w * to;
        return this.normalize();
    }
    pack() {
        const components = [this.x, this.y, this.z, this.w];
        let largest = 0;
        for (let i = 1; i < 4; i++) {
            if (Math.abs(components[i]) > Math.abs(components[largest])) {
                largest = i;
            }
        }
        const sign = components[largest] < 0 ? -1 : 1;
        let packed = largest;
        for (let i = 0; i < 4; i++) {
            if (i !== largest) {
                const value = (components[i] * sign) / SMALLEST_RANGE;
                const quantized = Math.round(Math.max(-1, Math.min(1, value)) * COMPONENT_STEPS) + COMPONENT_STEPS;
                packed = packed * (COMPONENT_MASK + 1) + quantized;
            }
        }
        return packed >>> 0;
    }
    unpack(packed) {
        const largest = packed >>> (3 * COMPONENT_BITS);
        const components = [0, 0, 0, 0];
        let sum = 0;
        let shift = 2 * COMPONENT_BITS;
        for (let i = 0; i < 4; i++) {
            if (i !== largest) {
                const quantized = (packed >>> shift) & COMPONENT_MASK;
                const value = ((quantized - COMPONENT_STEPS) / COMPONENT_STEPS) * SMALLEST_RANGE;
                components[i] = value;
                sum += value * value;
                shift -= COMPONENT_BITS;
            }
        }
        components[largest] = Math.sqrt(Math.max(0, 1 - sum));
        return this.set(components[0], components[1], components[2], components[3]).normalize();
    }
    clone() {
        return new Quaternion(this.x, this.y, this.z, this.w);
    }
}
Quaternion.IDENTITY = Object.freeze(new Quaternion());
Quaternion.TEMP1 = new Quaternion();
Quaternion.TEMP2 = new Quaternion();
class ObservableQuaternion extends Quaternion {
    constructor(x, y, z, w) {
        super(x, y, z, w);
        this.stored = new Quaternion(this.x, this.y, this.z, this.w);
    }
    store() {
        this.stored.set(this);
        return this;
    }
    hasUpdated(minimumAngle = 0) {
        return this.angleTo(this.stored) > minimumAngle;
    }
}
export { ObservableQuaternion, Quaternion };
