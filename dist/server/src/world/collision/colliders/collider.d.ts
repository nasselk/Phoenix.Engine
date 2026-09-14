import { Vector3 } from "../../../../../shared/libs/math/vector3D";
import type { PositionEntity } from "../../position";
import { type ResolveOptions } from "../resolvers/resolve";
import type { ColliderKind, Collision } from "../kind";
export declare abstract class Collider {
    abstract readonly kind: ColliderKind;
    entity?: PositionEntity<any>;
    readonly offset: Vector3;
    isStatic: boolean;
    restitution: number;
    friction: number;
    enabled: boolean;
    attach(entity: PositionEntity<any>): this;
    detach(): this;
    center(out?: Vector3): Vector3;
    collide(other: Collider | PositionEntity<any>): Collision | undefined;
    intersects(other: Collider | PositionEntity<any>): boolean;
    resolve(other: Collider | PositionEntity<any>, options?: ResolveOptions): Collision | undefined;
    separate(other: Collider | PositionEntity<any>): Collision | undefined;
}
