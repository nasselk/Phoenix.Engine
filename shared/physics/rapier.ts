import RAPIER from "@dimforge/rapier3d-simd-compat";

export { RAPIER };

let loading: Promise<void> | undefined;

/**
 * Load Rapier's WebAssembly. Once per process however often it is asked, and nothing physical can be
 * built before it resolves: the engine waits on it in `init`.
 */
export function initPhysics(): Promise<void> {
	loading ??= RAPIER.init();

	return loading;
}

export { eulerToQuaternion, quaternionToEuler } from "../math/quaternion";
