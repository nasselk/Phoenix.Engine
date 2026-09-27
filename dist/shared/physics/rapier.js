import RAPIER from "@dimforge/rapier3d-simd-compat";
export { RAPIER };
let loading;
export function initPhysics() {
    loading ?? (loading = RAPIER.init());
    return loading;
}
export { eulerToQuaternion, quaternionToEuler } from "../math/quaternion";
