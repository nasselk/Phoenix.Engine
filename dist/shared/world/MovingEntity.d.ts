import { Vector3 } from "../libs/math/vector3D";
export declare const STOP_SPEED = 0.05;
type VectorOptions = {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
};
export type MovingOptions = {
    readonly velocity?: VectorOptions;
    readonly gravity?: VectorOptions;
    readonly weight?: number;
    readonly damping?: number;
};
export interface MovingBody {
    readonly position: Vector3;
    readonly velocity: Vector3;
    readonly gravity: Vector3;
    readonly weight: number;
    readonly damping: number;
    readonly area: number;
}
export declare function createVelocity({ velocity }: MovingOptions): Vector3;
export declare function createGravity({ gravity }: MovingOptions): Vector3;
export declare function massOf(body: Pick<MovingBody, "weight">): number;
export declare function hasGravity(body: Pick<MovingBody, "weight" | "gravity">): boolean;
export declare function applyForce(body: Pick<MovingBody, "weight" | "velocity">, force: Vector3, deltaTime: number): void;
export declare function airResistance(body: Pick<MovingBody, "weight" | "damping" | "area">, speed: number): number;
export declare function integrate(body: MovingBody, deltaTime: number, resistance: (speed: number) => number): void;
export {};
