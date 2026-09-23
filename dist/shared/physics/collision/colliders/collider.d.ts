import { Vector3 } from "../../../libs/math/vector3D";
import { type MovingBody } from "../../body";
import { type ResolveOptions } from "../resolvers/resolve";
import type { ColliderKind, Collision } from "../kind";
export type ColliderBody = {
    readonly position: Vector3;
    collider?: Collider;
};
export declare abstract class Collider {
    abstract readonly kind: ColliderKind;
    entity?: ColliderBody;
    body?: MovingBody;
    readonly offset: Vector3;
    isStatic: boolean;
    restitution: number;
    friction: number;
    enabled: boolean;
    attach(entity: ColliderBody): this;
    detach(): this;
    center(out?: Vector3): Vector3;
    collide(other: Collider | ColliderBody): Collision | undefined;
    intersects(other: Collider | ColliderBody): boolean;
    resolve(other: Collider | ColliderBody, options?: ResolveOptions): Collision | undefined;
    separate(other: Collider | ColliderBody): Collision | undefined;
}
