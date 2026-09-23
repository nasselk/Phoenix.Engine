import type { ColliderDesc, RigidBody, RigidBodyDesc } from "@dimforge/rapier3d-compat";
import { PositionEntity, type PositionEntityOptions } from "./position";
import type { World } from "../world";
type VectorOptions = {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
};
export type MovingEntityOptions = PositionEntityOptions & {
    readonly velocity?: VectorOptions;
    readonly gravityScale?: number;
    readonly damping?: number;
};
export declare abstract class MovingEntity<C> extends PositionEntity<C> {
    private readonly initial;
    constructor(world: World<any, any>, context: C, options?: MovingEntityOptions);
    protected embody(body: RigidBodyDesc, ...shapes: readonly ColliderDesc[]): RigidBody;
    applyImpulse(x: number, y: number, z: number): this;
    update(_deltaTime: number): void;
}
export {};
