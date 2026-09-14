import { Vector3 } from "../../../shared/libs/math/vector3D";
import type { Engine } from "..";
import { PositionEntity } from "./position";
export declare const STOP_SPEED = 0.05;
export declare abstract class MovingEntity<C = Engine, G = unknown> extends PositionEntity<C, G> {
    readonly velocity: Vector3;
    positionSmoothing: boolean;
    weight: number;
    damping: number;
    get area(): number;
    readonly gravity: Vector3;
    get mass(): number;
    get speed(): number;
    get isMoving(): boolean;
    get hasGravity(): boolean;
    stop(): this;
    applyForce(force: Vector3, deltaTime: number): this;
    protected resistance(speed: number): number;
    update(deltaTime: number): void;
}
