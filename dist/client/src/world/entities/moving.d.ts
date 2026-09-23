import { PositionEntity, type PositionEntityOptions } from "./position";
export type MovingEntityOptions = PositionEntityOptions;
export declare abstract class MovingEntity<C> extends PositionEntity<C> {
}
