import { randomInt } from "../libs/math/random";
import { JsonObject } from "./types";

export function removeFromArray<T>(array: T[], item?: T, index?: number): T | void {
	if (index !== undefined) {
		const last = array.pop()!;

		if (index < array.length) {
			array[index] = last;

			return last;
		}
	} else {
		for (let i = 0; i < array.length; i++) {
			if (array[i] === item) {
				const last = array.pop()!;

				if (i < array.length) {
					array[i] = last;

					return last;
				}

				break;
			}
		}
	}
}

export function randomValue<T>(list: T[], random?: () => number): T;
export function randomValue<T>(...values: T[]): T;
export function randomValue(...params: any[]): any {
	if (Array.isArray(params[0])) {
		const array = params[0];
		const random = params[1];
		const index = randomInt(0, array.length - 1, random);

		return array[index];
	} else {
		const index = randomInt(0, params.length - 1);

		return params[index];
	}
}

export function deepMerge<A extends JsonObject, B extends JsonObject>(target: A, source: B): A & B {
	for (const key of Object.keys(source)) {
		const s = source[key];
		const t = target[key];

		if (s !== null && typeof s === "object" && !Array.isArray(s) && t !== null && typeof t === "object" && !Array.isArray(t)) {
			deepMerge(t, s);
		} else if (s !== null && typeof s === "object") {
			(target as any)[key] = structuredClone(s);
		} else {
			(target as any)[key] = s;
		}
	}

	return target as A & B;
}

export function deepCopy<T extends JsonObject>(source: T): T {
	if (source === null || typeof source !== "object") return source;
	if (Array.isArray(source)) return (source as any).map((item: any) => deepCopy(item)) as T;

	const target = {} as T;

	for (const key in source) {
		const value = source[key];
		target[key] = value !== null && typeof value === "object" ? deepCopy(value as any) : value;
	}

	return target;
}
