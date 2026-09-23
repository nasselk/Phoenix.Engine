import { type Vector3Structure } from "../libs/math/vector3D";
import type { Constructor } from "../utils/types";
type QueryCallback<T, Types, P extends any[]> = (objects: Types extends undefined ? T[] : {
    [K in keyof Types]: Types[K] extends Constructor<infer R> ? R[] : never;
}, queryID: number, param1: P[0], param2: P[1]) => boolean | void;
type PairsQueryCallback<T> = (entity1: T, entity2: T) => void;
type QueryCallbackValue<T extends HashGrid3D<any, any>> = Parameters<Parameters<T["query"]>[1]>[0];
type PairQueryCallbackValue<T extends HashGrid3D<any, any>> = Parameters<T["pairsQuery"]>[0];
interface Entity {
    id: number;
    readonly position: Vector3Structure;
    readonly size: Vector3Structure;
    readonly type: string;
    alive: boolean;
    cellsKeys: Set<number>[];
    queryID: number;
    cellMinX: number;
    cellMinY: number;
    cellMinZ: number;
}
declare class HashGrid3D<T extends Entity, Types extends Record<string, Constructor<T>> | undefined = undefined> {
    static gridCount: number;
    readonly id: number;
    private cellWidth;
    private cellHeight;
    private cellDepth;
    private cells;
    private cellActivity;
    private activityVersion;
    private readonly removableObjects;
    private readonly boundsBuffer;
    private maxKeyX;
    private maxKeyY;
    private maxKeyZ;
    private maxKey;
    private readonly typed;
    private readonly types?;
    private readonly typesKeys?;
    private cellKeys;
    private queryID;
    entityCount: number;
    totalEntitiesInCells: number;
    private readonly query2OutputCache;
    private readonly bounds;
    constructor(cellWidth: number, cellHeight: number | undefined, cellDepth: number | undefined, bounds: {
        min: Vector3Structure;
        max: Vector3Structure;
    }, removableObjects?: boolean, types?: Types);
    resize(bounds: {
        min: Vector3Structure;
        max: Vector3Structure;
    }, cellWidth?: number, cellHeight?: number, cellDepth?: number, restore?: boolean): this;
    initCells(): this;
    private getCellID;
    private createCell;
    private getCell;
    private getBounds;
    insert(object: T, rangeX?: number, rangeY?: number, rangeZ?: number, type?: string): this;
    remove(object: T, type?: string): this;
    update(object: T, rangeX?: number, rangeY?: number, rangeZ?: number, type?: string): this;
    query<P extends any[] = any[]>(object: T, callback: QueryCallback<T, Types, P>, rangeX?: number, rangeY?: number, rangeZ?: number, param1?: P[0], param2?: P[1]): boolean;
    query2<D extends (keyof Types)[]>(object: T, rangeX?: number, rangeY?: number, rangeZ?: number): Types extends undefined ? T[] : {
        [K in D[number]]: Types[K] extends Constructor<infer R> ? R[] : never;
    };
    private incrementQueryID;
    clearQuery2OutputCache(): this;
    pairsQuery(callback: PairsQueryCallback<T>): number;
    get activity(): number;
    activitySince(cellsKeys: Set<number>, version: number): boolean;
    clear(clean?: Map<number, T>): this;
    get cellCount(): number;
}
export { HashGrid3D as HashGrid, type QueryCallbackValue as QueryCallback, type PairQueryCallbackValue as PairQueryCallback };
