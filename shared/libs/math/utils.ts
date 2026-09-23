export const EPSILON = 1e-10;

/**
 * Clamps a value between a minimum and maximum value.
 *
 * @param value - The value to clamp.
 * @param minimum - The minimum allowed value.
 * @param maximum - The maximum allowed value.
 * @returns The clamped value.
 * @throws {RangeError} If min is greater than max.
 *
 * @example
 * clamp(5, 0, 10) // 5
 * clamp(-5, 0, 10) // 0
 * clamp(15, 0, 10) // 10
 */
export function clamp(value: number, minimum: number, maximum: number): number {
	if (minimum > maximum) {
		throw new RangeError("Invalid range");
	}

	return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Wraps a value to stay within a range using modulo arithmetic.
 * Useful for circular/periodic values like angles or array indices.
 *
 * @param value - The value to wrap.
 * @param minimum - The minimum value of the range.
 * @param maximum - The maximum value of the range.
 * @returns The wrapped value within [min, max].
 *
 * @example
 * wrap(5, 0, 10) // 5
 * wrap(15, 0, 10) // 5
 * wrap(-5, 0, 10) // 5
 * wrap(370, 0, 360) // 10 (angle wrapping)
 */
export function wrap(value: number, minimum: number, maximum: number): number {
	if (minimum > maximum) {
		throw new RangeError("Invalid range");
	}

	const range = maximum - minimum;

	return ((((value - minimum) % range) + range) % range) + minimum;
}

/**
 * Returns the sign of a number.
 *
 * @param value - The number to get the sign of.
 * @returns 1 if positive, -1 if negative, 0 if zero.
 *
 * @example
 * sign(5) // 1
 * sign(-5) // -1
 * sign(0) // 0
 */
export function sign(value: number): number {
	return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/**
 * Calculates what percentage a value represents of a maximum value.
 *
 * @param value - The current value.
 * @param max - The maximum value (100%).
 * @param round - Whether to round the result (defaults to true).
 * @returns The percentage (0-100).
 *
 * @example
 * percentage(50, 100) // 50
 * percentage(25, 200) // 12.5
 * percentage(75, 50) // 150
 */
export function percentage(value: number, max: number = 100, round: boolean = true): number {
	const result = (value / max) * 100;

	return round ? Math.round(result) : result;
}

/**
 * Scales numbers of an array such that they sum up to 1.
 *
 * @param array - The array to normalize.
 * @returns the same array, modified in-place.
 *
 * @example
 * normalizeArray([1, 2, 2, 3]) // [0.125, 0.25, 0.25, 0.375]
 * normalizeArray([1, 3, 2]) // [1/6, 3/6, 2/6]
 *
 * @throws {RangeError} if elements in the array sum to zero
 */
export function normalizeArray(array: number[]): number[] {
	// normalize
	let total: number = 0;
	for (let i = 0; i < array.length; i++) {
		total += array[i];
	}

	if (total === 0) {
		throw new RangeError("Normalized elements sum to zero!");
	}

	for (let i = 0; i < array.length; i++) {
		array[i] /= total;
	}

	return array;
}

/**
 * Calculates the Euclidean distance between two points.
 *
 * @param x1 - X-coordinate of the first point.
 * @param y1 - Y-coordinate of the first point.
 * @param x2 - X-coordinate of the second point.
 * @param y2 - Y-coordinate of the second point.
 * @returns The distance between the two points.
 *
 * @example
 * distance(0, 0, 3, 4) // 5
 * distance(0, 0, 1, 1) // ~1.414
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
	const dx = x2 - x1;
	const dy = y2 - y1;
	return Math.sqrt(dx ** 2 + dy ** 2);
}

/**
 * Calculates the squared Euclidean distance between two points.
 * More efficient than `distance()` when only comparing distances,
 * since it avoids the expensive square root operation.
 *
 * @param x1 - X-coordinate of the first point.
 * @param y1 - Y-coordinate of the first point.
 * @param x2 - X-coordinate of the second point.
 * @param y2 - Y-coordinate of the second point.
 * @returns The squared distance between the two points.
 *
 * @example
 * distanceSquared(0, 0, 3, 4) // 25
 * distanceSquared(0, 0, 1, 1) // 2
 */
export function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
	const dx = x2 - x1;
	const dy = y2 - y1;
	return dx ** 2 + dy ** 2;
}
