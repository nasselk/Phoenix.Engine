import { Vector3 } from "../../libs/math/vector3D";
import { PositionEntity } from "./position";
export declare class MovingEntity extends PositionEntity {
    readonly velocity: Vector3;
    get speed(): number;
    get isMoving(): boolean;
    stop(): this;
    update(deltaTime: number): void;
}
