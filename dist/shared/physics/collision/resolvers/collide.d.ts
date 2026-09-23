import type { Collider } from "../colliders/collider";
import { type Collision } from "../kind";
export declare function collide(a: Collider, b: Collider): Collision | undefined;
