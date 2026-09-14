import { Vector3 } from "../../../../shared/libs/math/vector3D";
import type { PositionEntity } from "../position";
import type { ColliderKind, Collision } from "./kind";
export declare abstract class Collider {
    abstract readonly kind: ColliderKind;
    entity?: PositionEntity;
    readonly offset: Vector3;
    isStatic: boolean;
    enabled: boolean;
    attach(entity: PositionEntity): this;
    detach(): this;
    center(out?: Vector3): Vector3;
    collide(other: Collider | PositionEntity): Collision | undefined;
    intersects(other: Collider | PositionEntity): boolean;
    separate(other: Collider | PositionEntity): Collision | undefined;
}
