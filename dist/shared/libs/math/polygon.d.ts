import { Vector } from "./vector.js";
export declare class Polygon {
    readonly points: Vector[];
    readonly triangles: Polygon[];
    private _minX;
    private _minY;
    private _maxX;
    private _maxY;
    private _boundsDirty;
    constructor(x: number, y: number, width: number, height: number, offset?: number, scale?: number);
    constructor(shape: Vector[], offset?: number, scale?: number);
    [Symbol.iterator](): IterableIterator<Vector>;
    forEach(callback: (value: Vector, index?: number) => void): void;
    static union(...polygons: Polygon[]): Polygon;
    private init;
    triangulate(): Polygon[] | void;
    private fromRectangle;
    set(points: Vector[]): this;
    add(point: Vector): this;
    remove(): this;
    closestPoint(point: Vector, inset?: number): Vector;
    extrude(offset: number, apply?: boolean): Polygon;
    private ensureBounds;
    intersects(position: Vector, radius?: number): boolean;
    clone(): Polygon;
    get center(): Vector;
    get width(): number;
    get height(): number;
    get dimensions(): Vector;
    get bounds(): {
        min: Vector;
        max: Vector;
    };
    get area(): number;
    get perimeter(): number;
}
