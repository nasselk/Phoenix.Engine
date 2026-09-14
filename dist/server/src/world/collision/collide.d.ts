import type { Collider } from "./collider";
import { type Collision } from "./kind";
export declare function collide(a: Collider, b: Collider): Collision | undefined;
