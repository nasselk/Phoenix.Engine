import RAPIER from "@dimforge/rapier3d-compat";
export { RAPIER };
let loading;
export function initPhysics() {
    loading ?? (loading = RAPIER.init());
    return loading;
}
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
