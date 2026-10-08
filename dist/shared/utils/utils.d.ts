import { JsonObject } from "./types";
export declare function removeFromArray<T>(array: T[], item?: T, index?: number): T | void;
export declare function deepMerge<A extends JsonObject, B extends JsonObject>(target: A, source: B): A & B;
export declare function deepCopy<T extends JsonObject>(source: T): T;
