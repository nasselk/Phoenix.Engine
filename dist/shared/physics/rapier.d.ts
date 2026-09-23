import RAPIER, { type Rotation } from "@dimforge/rapier3d-compat";
export { RAPIER };
export declare function initPhysics(): Promise<void>;
export declare function eulerToQuaternion(pitch: number, yaw: number, roll: number, out: Rotation): Rotation;
export declare function quaternionToEuler({ x, y, z, w }: Rotation, out: [number, number, number]): [number, number, number];
