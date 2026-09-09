import { Vector } from "./vector.js";

/**
 * Generates a random boolean value based on weighted probabilities.
 *
 * @param w1 - Weight for returning true (defaults to 0.5).
 * @param w2 - Weight for returning false (defaults to 0.5).
 * @returns True if the first weight is selected, false otherwise.
 *
 * @example
 * randomBoolean() // 50% true, 50% false
 * randomBoolean(0.7, 0.3) // 70% true, 30% false
 * randomBoolean(1, 3) // 25% true, 75% false
 */
export function randomBoolean(w1: number = 0.5, w2: number = 0.5): boolean {
	return weightedRandom(w1, w2) === 0;
}

/**
 * Generates a random integer between min and max (inclusive).
 *
 * @param min - The minimum value (inclusive).
 * @param max - The maximum value (inclusive).
 * @param random - Optional custom random function (defaults to Math.random).
 * @returns A random integer between min and max.
 * @throws {RangeError} If min is greater than max.
 *
 * @example
 * randomInt(1, 6) // Random dice roll (1-6)
 * randomInt(0, 100) // Random percentage
 * randomInt(-10, 10) // Random value from -10 to 10
 */
export function randomInt(min: number, max: number, random: () => number = Math.random): number {
	if (min > max) {
		throw new RangeError("Invalid range");
	}

	return Math.floor(random() * (max - min + 1) + min);
}

/**
 * Generates a random floating-point number between min and max.
 *
 * @param min - The minimum value (inclusive, defaults to 0).
 * @param max - The maximum value (exclusive, defaults to 1).
 * @param random - Optional custom random function (defaults to Math.random).
 * @returns A random float between min and max.
 * @throws {RangeError} If min is greater than max.
 *
 * @example
 * randomFloat() // Random value between 0 and 1
 * randomFloat(0, 100) // Random value between 0 and 100
 * randomFloat(-1, 1) // Random value between -1 and 1
 */
export function randomFloat(min: number = 0, max: number = 1, random: () => number = Math.random): number {
	if (min > max) {
		throw new RangeError("Invalid range");
	}

	return random() * (max - min) + min;
}

/**
 * Picks a random element from the given array
 *
 * @param array - The array to pick an element from
 *
 * @example
 * randomElement(["mouse", "rabbit", "pigeon"]) // e.g., "rabbit"
 */
export function randomElement<T>(array: readonly T[]): T {
	return array[Math.floor(Math.random() * array.length)];
}

/**
 * Selects a random index based on weighted probabilities.
 * Weights are automatically normalized - they don't need to sum to 1.
 * Higher weights increase the probability of that index being selected.
 *
 * @param weights - Variable number of weight values (must be positive numbers).
 * @returns The randomly selected index (0 to weights.length - 1).
 * @throws {RangeError} If no weights are provided or if any weight is non-positive.
 *
 * @example
 * weightedRandom(1, 2, 3) // 16.7% index 0, 33.3% index 1, 50% index 2
 * weightedRandom(50, 30, 15, 5) // Loot rarity: 50% common, 30% uncommon, 15% rare, 5% legendary
 *
 * @remarks
 * This function divides the probability space proportionally to the weights.
 * For example, weights [1, 2, 3] create ranges [0-1], [1-3], [3-6],
 * then a random value from 0-6 determines which range (index) is selected.
 */
export function weightedRandom(...weights: number[]): number {
	if (weights.length === 0) {
		throw new RangeError("At least one weight must be provided");
	}

	let total = 0;

	for (const weight of weights) {
		if (weight < 0) {
			throw new RangeError("Weights must be positive numbers");
		}

		total += weight;
	}

	const value = Math.random() * total;
	let accumulator = 0;

	for (let i = 0; i < weights.length; i++) {
		accumulator += weights[i];

		if (value < accumulator) {
			return i;
		}
	}

	return weights.length - 1; // Fallback for floating-point edge cases
}

/**
 * Generates a random point within a circular area or ring.
 * Uses uniform distribution to ensure even spread across the area.
 *
 * @param position - The center position of the circle.
 * @param radius - The outer radius of the circle.
 * @param innerRadius - The inner radius (defaults to 0 for a filled circle).
 * @param random - Optional custom random function (defaults to Math.random).
 * @returns A new Vector representing a random point in the circular area.
 *
 * @example
 * randomCirclePoint(new Vector(0, 0), 100) // Random point in circle of radius 100
 * randomCirclePoint(center, 50, 20) // Random point in ring (donut shape)
 *
 * @remarks
 * The square root in the distance calculation ensures uniform distribution.
 * Without it, points would cluster near the center.
 */
export function randomCirclePoint(position: Vector, radius: number, innerRadius: number = 0, random: () => number = Math.random): Vector {
	const angle = random() * 2 * Math.PI;
	const distance = innerRadius + Math.sqrt(random()) * (radius - innerRadius);

	return new Vector(angle, distance, true).add(position);
}

/**
 * Generates a random point within a triangle defined by three vertices.
 * Uses barycentric coordinates to ensure uniform distribution.
 *
 * @param p1 - First vertex of the triangle.
 * @param p2 - Second vertex of the triangle.
 * @param p3 - Third vertex of the triangle.
 * @param random - Optional custom random function (defaults to Math.random).
 * @returns A new Vector representing a random point inside the triangle.
 *
 * @example
 * const p1 = new Vector(0, 0);
 * const p2 = new Vector(100, 0);
 * const p3 = new Vector(50, 100);
 * randomTrianglePoint(p1, p2, p3) // Random point in triangle
 *
 * @remarks
 * This implementation uses the "square root method" to ensure uniform distribution.
 * The algorithm transforms two uniform random values into barycentric coordinates.
 */
export function randomTrianglePoint(p1: Vector, p2: Vector, p3: Vector, random = Math.random): Vector {
	const random1 = random();
	const random2 = random();

	const sqrt = Math.sqrt(random1);

	const x = (1 - sqrt) * p1.x + sqrt * (1 - random2) * p2.x + sqrt * random2 * p3.x;
	const y = (1 - sqrt) * p1.y + sqrt * (1 - random2) * p2.y + sqrt * random2 * p3.y;

	return new Vector(x, y);
}
