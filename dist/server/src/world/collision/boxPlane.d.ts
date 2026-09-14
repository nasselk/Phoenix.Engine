import type { BoxCollider } from "./box";
import type { Collision } from "./kind";
import type { PlaneCollider } from "./plane";
export declare function collideBoxPlane(box: BoxCollider, plane: PlaneCollider): Collision | undefined;
