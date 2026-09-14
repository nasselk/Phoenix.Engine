import type { Collider } from "../colliders/collider";
import type { Collision } from "../kind";
export declare const SLOP = 0.01;
export declare const RESTITUTION_THRESHOLD = 1;
export declare const DEFAULT_MASS = 1;
export declare const MIN_SLIDE = 0.000001;
export type ResolveOptions = {
    readonly restitution?: number;
    readonly friction?: number;
    readonly deltaTime?: number;
};
export declare function inverseMass(collider: Collider): number;
export declare function resolve(a: Collider, b: Collider, collision: Collision, options?: ResolveOptions): void;
