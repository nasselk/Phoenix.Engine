import { randomFloat } from "./random.js";

/**
 * Generates a random angle within a specified range.
 *
 * @param min - The minimum angle in radians (defaults to 0).
 * @param max - The maximum angle in radians (defaults to 2π).
 * @param random - Optional custom random function (defaults to Math.random).
 * @returns A random angle between min and max.
 * @throws {RangeError} If min is greater than max.
 *
 * @example
 * randomAngle() // Random angle between 0 and 2π
 * randomAngle(0, Math.PI) // Random angle between 0 and π
 * randomAngle(-Math.PI, Math.PI) // Random angle between -π and π
 */
export function randomAngle(min: number = 0, max: number = 2 * Math.PI, random = Math.random): number {
	return randomFloat(min, max, random);
}

/**
 * Calculates the shortest angular distance between two angles.
 * Always returns a value between 0 and π.
 *
 * @param a - The first angle in radians.
 * @param b - The second angle in radians.
 * @returns The shortest distance between the angles (always positive).
 *
 * @example
 * getAngleDistance(0, Math.PI / 2) // π/2 (~1.57)
 * getAngleDistance(0, Math.PI * 1.5) // π/2 (~1.57) - takes shorter path
 * getAngleDistance(0, 2 * Math.PI) // 0 - same angle
 */
export function getAngleDistance(a: number, b: number): number {
	const distance = Math.abs(normalizeAngle2PI(a - b));

	return Math.min(distance, 2 * Math.PI - distance);
}

/**
 * Normalizes an angle to the range [-π, π].
 * Useful for representing angles where direction matters (e.g., rotation direction).
 *
 * @param angle - The angle to normalize in radians.
 * @returns The normalized angle between -π and π.
 *
 * @example
 * normalizeAnglePI(0) // 0
 * normalizeAnglePI(Math.PI) // π (~3.14)
 * normalizeAnglePI(-Math.PI) // -π (~-3.14)
 * normalizeAnglePI(3 * Math.PI) // π (wraps around)
 * normalizeAnglePI(-3 * Math.PI) // -π (wraps around)
 */
export function normalizeAnglePI(angle: number): number {
	const PI = Math.PI;
	const twoPI = 2 * PI;

	angle = ((((angle + PI) % twoPI) + twoPI) % twoPI) - PI;

	return angle;
}

/**
 * Normalizes an angle to the range [0, 2π].
 * Useful for angles that should always be positive (e.g., compass directions).
 *
 * @param angle - The angle to normalize in radians.
 * @returns The normalized angle between 0 and 2π.
 *
 * @example
 * normalizeAngle2PI(0) // 0
 * normalizeAngle2PI(Math.PI) // π (~3.14)
 * normalizeAngle2PI(3 * Math.PI) // π (wraps around)
 * normalizeAngle2PI(-Math.PI / 2) // 3π/2 (~4.71)
 */
export function normalizeAngle2PI(angle: number): number {
	const twoPI = 2 * Math.PI;

	return ((angle % twoPI) + twoPI) % twoPI;
}

/**
 * Returns the distance between two angles, positive if clockwise and negative if anticlockwise.
 *
 * @param angle1 - The first angle
 * @param angle2 - The second angle
 * @returns The signed angle distance between -π and π.
 *
 * @example
 * signedAngleDistance(0, 0) // 0
 * signedAngleDistance(Math.PI / 3, Math.PI * 2/3) // π/3 (~1.05)
 * signedAngleDistance(Math.PI / 3, Math.PI * 5/3) // -2π/3 (negative because anticlockwise)
 * signedAngleDistance(Math.PI * 3, Math.PI) // 0 (wraps around)
 */
export function signedAngleDistance(angle1: number, angle2: number) {
	const twoPI = 2 * Math.PI;
	const dif = (angle2 - angle1) % twoPI;
	return ((2 * dif) % twoPI) - dif;
}

/**
 * Returns the opposite angle (180° rotation).
 *
 * @param angle - The angle in radians.
 * @returns The opposite angle, normalized to [0, 2π].
 *
 * @example
 * getOppositeAngle(0) // π (~3.14)
 * getOppositeAngle(Math.PI) // 0
 * getOppositeAngle(Math.PI / 2) // 3π/2 (~4.71)
 */
export function getOppositeAngle(angle: number): number {
	return (angle + Math.PI) % (2 * Math.PI);
}

/**
 * Converts degrees to radians.
 *
 * @param degrees - The angle in degrees.
 * @returns The angle in radians.
 *
 * @example
 * degreesToRadians(0) // 0
 * degreesToRadians(90) // π/2 (~1.57)
 * degreesToRadians(180) // π (~3.14)
 * degreesToRadians(360) // 2π (~6.28)
 */
export function degreesToRadians(degrees: number): number {
	const radians = degrees * (Math.PI / 180);

	return radians;
}

/**
 * Converts radians to degrees.
 *
 * @param radians - The angle in radians.
 * @returns The angle in degrees.
 *
 * @example
 * radiansToDegrees(0) // 0
 * radiansToDegrees(Math.PI / 2) // 90
 * radiansToDegrees(Math.PI) // 180
 * radiansToDegrees(2 * Math.PI) // 360
 */
export function radiansToDegrees(radians: number): number {
	const degrees = radians * (180 / Math.PI);

	return degrees;
}

/**
 * Finds the angle from a list that is closest to a reference angle.
 * Uses the shortest angular distance for comparison.
 *
 * @param reference - The reference angle to compare against in radians.
 * @param angles - The angles to search through in radians.
 * @returns The angle from the list that is closest to the reference angle.
 *
 * @example
 * closestAngle(0, Math.PI / 4, Math.PI, 3 * Math.PI / 2) // π/4 (~0.785)
 * closestAngle(Math.PI, 0, Math.PI / 2, 2 * Math.PI) // 0 or 2π (equivalent)
 */
export function closestAngle(reference: number, ...angles: number[]): number {
	reference = normalizeAngle2PI(reference);

	let closest = angles[0];
	let distance = getAngleDistance(reference, closest);

	for (let i = 1; i < angles.length; i++) {
		const newDistance = getAngleDistance(reference, angles[i]);

		if (newDistance < distance) {
			closest = angles[i];
			distance = newDistance;
		}
	}

	return closest;
}
