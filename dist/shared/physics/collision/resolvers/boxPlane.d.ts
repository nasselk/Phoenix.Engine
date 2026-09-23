import type { BoxCollider } from "../colliders/box";
import type { Collision } from "../kind";
import type { PlaneCollider } from "../colliders/plane";
export declare function collideBoxPlane(box: BoxCollider, plane: PlaneCollider): Collision | undefined;
