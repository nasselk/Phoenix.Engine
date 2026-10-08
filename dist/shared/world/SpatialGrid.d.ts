import type { Vector3Structure } from "../math/vector3";
export type Positioned = {
    readonly position: Vector3Structure;
};
export declare class SpatialGrid<T extends Positioned> {
    readonly cellSize: number;
    private readonly cells;
    private readonly keys;
    constructor(cellSize: number);
    insert(item: T): this;
    update(item: T): this;
    remove(item: T): boolean;
    has(item: T): boolean;
    query(center: Vector3Structure, radius: number, out?: T[]): T[];
    clear(): void;
    get size(): number;
    private keyOf;
    private static pack;
    private cell;
    private take;
}
