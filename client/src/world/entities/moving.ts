import { PositionEntity, type PositionEntityOptions } from "./position";

export type MovingEntityOptions = PositionEntityOptions;

/**
 * Something the physics moves. The client does not simulate yet, so for now this is drawn like any
 * PositionEntity, easing towards where the server says it is. Client prediction gives it a Rapier body,
 * the way the server's MovingEntity has one.
 */
export abstract class MovingEntity<C> extends PositionEntity<C> {}
