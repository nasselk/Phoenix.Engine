import RAPIER from "@dimforge/rapier3d-simd-compat";
export { RAPIER };
let loading;
export function initPhysics() {
    loading ?? (loading = RAPIER.init());
    return loading;
}
export { eulerToQuaternion, quaternionToEuler } from "../math/quaternion";
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFwaWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc2hhcmVkL3BoeXNpY3MvcmFwaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sTUFBTSxNQUFNLGdDQUFnQyxDQUFDO0FBRXBELE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUVsQixJQUFJLE9BQWtDLENBQUM7QUFNdkMsTUFBTSxVQUFVLFdBQVc7SUFDMUIsT0FBTyxLQUFQLE9BQU8sR0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLEVBQUM7SUFFMUIsT0FBTyxPQUFPLENBQUM7QUFDaEIsQ0FBQztBQUVELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9CQUFvQixDQUFDIn0=