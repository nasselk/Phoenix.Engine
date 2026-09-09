import { Vector3 } from "../../../shared/libs/math/vector3D";
import { PositionEntity } from "./position";
export declare class MovingEntity extends PositionEntity {
    readonly velocity: Vector3;
    weight: number;
    readonly gravity: Vector3;
    get speed(): number;
    get isMoving(): boolean;
    get hasGravity(): boolean;
    stop(): this;
    applyForce(force: Vector3, deltaTime: number): this;
    update(deltaTime: number): void;
}
