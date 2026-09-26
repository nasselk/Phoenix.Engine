import { clamp } from "./utils.js";

/**
 * Represents a simple 2D point or vector with x and y coordinates.
 * This is a structural type that can be satisfied by any object with x and y properties.
 * Use this for parameters that accept duck-typed vector-like objects.
 */
type Vector2Structure = { x: number; y: number };

/**
 * A 2D vector class providing vector mathematics operations.
 * Supports both Cartesian (x, y) and polar (angle, magnitude) coordinate systems.
 */
class Vector2 {
	/**
	 * A constant null vector at origin (0, 0).
	 *
	 * @remarks
	 * This is a frozen object and cannot be modified.
	 * Use this as a default value for rotation centers or origin points.
	 *
	 * @example
	 * // Rotate around origin
	 * vec.rotate(Math.PI / 2, Vector2D.NULL);
	 */
	public static readonly NULL: Vector2 = Object.freeze(new Vector2());

	/**
	 * A temporary vector instance for calculations to avoid creating new objects.
	 *
	 * @remarks
	 * This vector is mutable and should be used carefully to avoid unintended side effects.
	 *
	 * @example
	 * // Use TEMP1 for intermediate calculations
	 * const result = Vector2D.TEMP1.set(vec1).add(vec2);
	 */
	public static readonly TEMP1: Vector2 = new Vector2();
	public static readonly TEMP2: Vector2 = new Vector2();
	public static readonly TEMP3: Vector2 = new Vector2();
	public static readonly TEMP4: Vector2 = new Vector2();
	public static readonly TEMP5: Vector2 = new Vector2();

	/** The x-coordinate of the vector. */
	public x: number;

	/** The y-coordinate of the vector. */
	public y: number;

	/**
	 * Creates a new 2D vector using Cartesian coordinates.
	 *
	 * @param x - X-coordinate (defaults to 0).
	 * @param y - Y-coordinate (defaults to x if omitted).
	 *
	 * @example
	 * new Vector2D() // (0, 0)
	 * new Vector2D(5) // (5, 5)
	 * new Vector2D(3, 4) // (3, 4)
	 */
	public constructor(x?: number, y?: number);

	/**
	 * Creates a new 2D vector using polar coordinates.
	 *
	 * @param angle - Angle in radians.
	 * @param length - Magnitude (distance from origin).
	 * @param polar - Must be `true` to use this overload.
	 *
	 * @example
	 * new Vector2D(Math.PI / 4, 10, true) // Angle π/4, magnitude 10
	 */
	public constructor(angle: number, length: number, polar: true);

	public constructor(a: number = 0, b: number = a, polar: boolean = false) {
		if (polar) {
			this.x = b * Math.cos(a);
			this.y = b * Math.sin(a);
		} else {
			this.x = a;
			this.y = b;
		}
	}

	/**
	 * Sets this vector to be a copy of another vector, optionally scaled.
	 *
	 * @param vector - Vector to copy from.
	 * @param scalar - Optional multiplier (defaults to 1).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.set(other) // Copy other vector
	 * vec.set(other, 2) // Copy other vector scaled by 2
	 */
	public set(vector: Vector2Structure, scalar?: number): this;

	/**
	 * Sets this vector's x and y components.
	 *
	 * @param x - X-coordinate value.
	 * @param y - Y-coordinate value (defaults to x if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.set(5) // Set to (5, 5)
	 * vec.set(3, 4) // Set to (3, 4)
	 */
	public set(x: number, y?: number): this;

	public set(a: Vector2Structure | number, b?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x = a.x * scalar;
			this.y = a.y * scalar;
		} else {
			this.x = a;
			this.y = b ?? a;
		}

		return this;
	}

	/**
	 * Adds another vector to this vector, optionally scaled.
	 *
	 * @param vector - Vector to add.
	 * @param scalar - Optional multiplier for the vector being added (defaults to 1).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.add(other) // Add other vector
	 * vec.add(other, 2) // Add other vector scaled by 2
	 */
	public add(vector: Vector2Structure, scalar?: number): this;

	/**
	 * Adds individual values to this vector's components.
	 *
	 * @param x - X-coordinate value to add.
	 * @param y - Y-coordinate value to add (defaults to x if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.add(5) // Add 5 to both components
	 * vec.add(3, 4) // Add (3, 4)
	 */
	public add(x: number, y?: number): this;

	public add(a: Vector2Structure | number, b?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x += a.x * scalar;
			this.y += a.y * scalar;
		} else {
			this.x += a;
			this.y += b ?? a;
		}

		return this;
	}

	/**
	 * Subtracts another vector from this vector, optionally scaled.
	 *
	 * @param vector - Vector to subtract.
	 * @param scalar - Optional multiplier for the vector being subtracted (defaults to 1).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.subtract(other) // Subtract other vector
	 * vec.subtract(other, 2) // Subtract other vector scaled by 2
	 */
	public subtract(vector: Vector2Structure, scalar?: number): this;

	/**
	 * Subtracts individual values from this vector's components.
	 *
	 * @param x - X-coordinate value to subtract.
	 * @param y - Y-coordinate value to subtract (defaults to x if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.subtract(5) // Subtract 5 from both components
	 * vec.subtract(3, 4) // Subtract (3, 4)
	 */
	public subtract(x: number, y?: number): this;

	public subtract(a: Vector2Structure | number, b?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x -= a.x * scalar;
			this.y -= a.y * scalar;
		} else {
			this.x -= a;
			this.y -= b ?? a;
		}

		return this;
	}

	/**
	 * Performs component-wise multiplication with another vector, optionally scaled.
	 *
	 * @param vector - Vector for component-wise multiplication.
	 * @param scalar - Optional multiplier for the vector (defaults to 1).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.multiply(other) // Component-wise multiply
	 * vec.multiply(other, 2) // Multiply with other vector scaled by 2
	 */
	public multiply(vector: Vector2Structure, scalar?: number): this;

	/**
	 * Multiplies this vector's components by individual values.
	 *
	 * @param x - X-coordinate multiplier.
	 * @param y - Y-coordinate multiplier (defaults to x if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.multiply(2) // Scale by 2
	 * vec.multiply(2, 3) // Multiply x by 2, y by 3
	 */
	public multiply(x: number, y?: number): this;

	public multiply(a: Vector2Structure | number, b?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x *= a.x * scalar;
			this.y *= a.y * scalar;
		} else {
			this.x *= a;
			this.y *= b ?? a;
		}

		return this;
	}

	/**
	 * Performs component-wise division by another vector, optionally scaled.
	 *
	 * @param vector - Vector for component-wise division.
	 * @param scalar - Optional multiplier for the divisor vector (defaults to 1).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.divide(other) // Component-wise divide
	 * vec.divide(other, 2) // Divide by other vector scaled by 2
	 */
	public divide(vector: Vector2Structure, scalar?: number): this;

	/**
	 * Divides this vector's components by individual values.
	 *
	 * @param x - X-coordinate divisor.
	 * @param y - Y-coordinate divisor (defaults to x if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.divide(2) // Divide by 2
	 * vec.divide(2, 4) // Divide x by 2, y by 4
	 */
	public divide(x: number, y?: number): this;

	public divide(a: Vector2Structure | number, b?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x /= a.x * scalar;
			this.y /= a.y * scalar;
		} else {
			if (a === 0) {
				throw new Error("Division by zero in vector division with x component");
			} else if (b === 0) {
				throw new Error("Division by zero in vector division with y component");
			}

			this.x /= a;
			this.y /= b ?? a;
		}

		return this;
	}

	/**
	 * Scales this vector by a scalar value.
	 * Alias for `multiply(scalar)`.
	 *
	 * @param scalar - The scalar value to multiply both components by.
	 * @returns This vector for method chaining.
	 */
	public scale(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;

		return this;
	}

	/**
	 * Adds a displacement in a specific direction (polar coordinates).
	 * More efficient than creating a polar vector for one-time directional movement.
	 *
	 * @param angle - The angle in radians.
	 * @param distance - The distance to move in that direction.
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * // Move 10 units to the right (0 radians)
	 * position.addDirection(0, 10);
	 *
	 * // Move 5 units at 45 degrees
	 * position.addDirection(Math.PI / 4, 5);
	 */
	public addDirection(angle: number, distance: number): this {
		this.x += distance * Math.cos(angle);
		this.y += distance * Math.sin(angle);

		return this;
	}

	/**
	 * Moves this vector partially towards another vecto.
	 *
	 * @param otherVec - The vector to interpolate towards.
	 * @param t - The amount to interpolate by. A value of 0 makes no change to this vector, whereas a value of 1 makes this vector copy the other's components.
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * // Set this vector to the midpoint of it and (5, 5)
	 * position.interpolate(new Vector2D(5, 5), 0.5);
	 *
	 * // Move this vector 10% of the way to (1, 2)
	 * position.addDirection(new Vector2D(1, 2), 0.1);
	 */
	public interpolate(otherVec: Vector2, t: number) {
		this.x += (otherVec.x - this.x) * t;
		this.y += (otherVec.y - this.y) * t;

		return this;
	}

	/**
	 * Sets this vector to a specific direction and distance from the origin.
	 *
	 * @param angle - The angle in radians.
	 * @param distance - The distance from the origin.
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * // Set to 10 units to the right (0 radians)
	 * position.setDirection(0, 10);
	 *
	 * // Set to 5 units at 45 degrees
	 * position.setDirection(Math.PI / 4, 5);
	 */

	public setDirection(angle: number, distance: number): this {
		this.x = distance * Math.cos(angle);
		this.y = distance * Math.sin(angle);

		return this;
	}

	/**
	 * Calculates the dot product of this vector with another.
	 * Useful for determining the angle between vectors or projecting one vector onto another.
	 *
	 * @param vector - The vector to calculate the dot product with.
	 * @returns The dot product (scalar value).
	 */
	public dot(vector: Vector2Structure): number {
		return this.x * vector.x + this.y * vector.y;
	}

	/**
	 * Calculates the 2D cross product (z-component) of this vector with another.
	 * Returns a scalar representing the magnitude of the perpendicular vector.
	 * Positive if the other vector is counter-clockwise from this, negative if clockwise.
	 *
	 * @param vector - The vector to calculate the cross product with.
	 * @returns The cross product (scalar value).
	 */
	public cross(vector: Vector2Structure): number {
		return this.x * vector.y - this.y * vector.x;
	}

	/**
	 * Calculates the vector difference from this vector to another.
	 *
	 * @param vector - The target vector to calculate the difference to.
	 * @returns A new Vector2D representing the difference (this - vector).
	 *
	 * @example
	 * const a = new Vector2D(3, 4);
	 * const b = new Vector2D(1, 2);
	 * const delta = a.delta(b); // delta is (2, 2)
	 */
	public delta(vector: Vector2Structure): Vector2 {
		return new Vector2(vector.x - this.x, vector.y - this.y);
	}

	/**
	 * Calculates the midpoint between this vector and another.
	 *
	 * @param vector - The vector to calculate the midpoint with.
	 * @returns A new Vector2D representing the midpoint.
	 *
	 * @example
	 * const a = new Vector2D(0, 0);
	 * const b = new Vector2D(4, 4);
	 * const mid = a.midpoint(b); // mid is (2, 2)
	 */
	public midpoint(vector: Vector2Structure): Vector2 {
		return new Vector2((this.x + vector.x) / 2, (this.y + vector.y) / 2);
	}

	/**
	 * Normalizes this vector to unit length (magnitude of 1).
	 *
	 * @returns This vector for method chaining.
	 */
	public normalize(): this {
		if (this.isNull) {
			return this;
		}

		const magnitude = this.magnitude;

		return this.divide(magnitude);
	}

	/**
	 * Rotates this vector by the specified angle around a point.
	 *
	 * @param angle - The rotation angle in radians (counter-clockwise).
	 * @param point - The point to rotate around (defaults to origin).
	 * @returns This vector for method chaining.
	 */
	public rotate(angle: number, point: Vector2Structure = Vector2.NULL): this {
		const dx = this.x - point.x;
		const dy = this.y - point.y;

		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		const x = dx * cos - dy * sin;
		const y = dx * sin + dy * cos;

		this.x = x + point.x;
		this.y = y + point.y;

		return this;
	}

	/**
	 * Calculates the Euclidean distance from this vector to another point.
	 *
	 * @param vector - The point to calculate distance to.
	 * @returns The distance between the two points.
	 */
	public distance(vector: Vector2Structure): number {
		const dx = this.x - vector.x;
		const dy = this.y - vector.y;

		return Math.sqrt(dx ** 2 + dy ** 2);
	}

	/**
	 * Calculates the squared distance from this vector to another point.
	 * More efficient than `distance()` when only comparing distances.
	 *
	 * @param vector - The point to calculate squared distance to.
	 * @returns The squared distance between the two points.
	 */
	public distanceSquared(vector: Vector2Structure): number {
		const dx = this.x - vector.x;
		const dy = this.y - vector.y;

		return dx ** 2 + dy ** 2;
	}

	/**
	 * Calculates the angle from this vector to another point in radians.
	 * Returns a value between -π and π.
	 *
	 * @param vector - The point to calculate the angle to.
	 * @returns The angle in radians.
	 */
	public angleTo(vector: Vector2Structure): number {
		const dx = vector.x - this.x;
		const dy = vector.y - this.y;

		return Math.atan2(dy, dx);
	}

	/**
	 * Calculates the shortest distance from this point to a line segment.
	 *
	 * @param p1 - First endpoint of the line segment.
	 * @param p2 - Second endpoint of the line segment.
	 * @returns The shortest distance to the line segment.
	 */
	public segmentDistance(p1: Vector2, p2: Vector2): number {
		const projection = this.projectOnSegment(p1, p2);

		return this.distance(projection);
	}

	/**
	 * Projects this point onto a line segment, clamped between the endpoints.
	 * Returns the closest point on the segment to this point.
	 *
	 * @param p1 - First endpoint of the line segment.
	 * @param p2 - Second endpoint of the line segment.
	 * @returns A new Vector2D representing the closest point on the segment.
	 */
	public projectOnSegment(p1: Vector2, p2: Vector2): Vector2 {
		const ab = p2.clone().subtract(p1);
		const t = clamp(this.clone().subtract(p1).dot(ab) / ab.magnitudeSquared, 0, 1);
		return p1.clone().add(ab.scale(t));
	}

	/**
	 * Projects this point onto a line segment.
	 * Returns the closest point on the segment to this point.
	 *
	 * @param p - A vector defining the line segment.
	 * @returns A new Vector2D representing the closest point on the segment.
	 */
	public project(p: Vector2): Vector2 {
		const t = this.clone().dot(p) / p.magnitudeSquared;
		return p.clone().add(p.scale(t));
	}

	/**
	 * Reflects this vector across a surface defined by a normal vector.
	 * Modifies this vector in place.
	 *
	 * @param normal - The normal vector of the reflecting surface (should be unit length).
	 * @returns This vector for method chaining.
	 */
	public reflect(normal: Vector2Structure): this {
		const dotProduct = this.dot(normal);

		return this.subtract(normal, 2 * dotProduct);
	}

	/**
	 * Checks if this vector is exactly equal to certain values.
	 *
	 * @param x - The x-coordinate to compare against.
	 * @param y - The y-coordinate to compare against.
	 * @returns True if both x and y components are equal.
	 */
	public equals(x: number, y?: number): boolean;

	/**
	 * Checks if this vector is exactly equal to another.
	 *
	 * @param vector - The vector to compare against.
	 * @returns True if both x and y components are equal.
	 */
	public equals(vector: Vector2Structure): boolean;

	public equals(a: Vector2Structure | number, b?: number): boolean {
		if (typeof a === "object") {
			return this.x === a.x && this.y === a.y;
		} else {
			b ??= a;

			return this.x === a && this.y === b;
		}
	}

	/**
	 * Returns a string representation of this vector.
	 *
	 * @returns A string in the format "Vector2(x, y)".
	 */
	public toString(): string {
		return `Vector2(${this.x}, ${this.y})`;
	}

	/**
	 * Creates a new vector with the same components as this one.
	 *
	 * @returns A new Vector2D instance with the same x and y values.
	 */
	public clone(): Vector2 {
		return new Vector2(this.x, this.y);
	}

	/**
	 * Gets the normalized perpendicular (normal) vector.
	 * Rotates this vector 90 degrees counter-clockwise and normalizes it.
	 *
	 * @returns A new normalized perpendicular vector.
	 */
	public get normal(): Vector2 {
		const vector = new Vector2(-this.y, this.x);

		return vector.normalize();
	}

	/**
	 * Gets the length (magnitude) of this vector.
	 *
	 * @returns The magnitude of the vector.
	 */
	public get magnitude(): number {
		return Math.sqrt(this.x ** 2 + this.y ** 2);
	}

	/**
	 * Sets the length (magnitude) of this vector while preserving its direction.
	 * Scales the vector to the specified length.
	 *
	 * @param value - The desired magnitude (length) of the vector.
	 * @throws {Error} If attempting to set the magnitude of a null vector (magnitude of 0).
	 *
	 * @example
	 * const vec = new Vector2D(3, 4); // magnitude is 5
	 * vec.magnitude = 10; // Now magnitude is 10, direction unchanged
	 */
	public set magnitude(value: number) {
		const magnitude = this.magnitude;

		if (magnitude === 0) {
			throw new Error("Cannot set magnitude of a null vector");
		}

		const scale = value / magnitude;

		this.scale(scale);
	}

	/**
	 * Gets the squared length of this vector.
	 * More efficient than `magnitude` when only comparing lengths.
	 *
	 * @returns The squared magnitude of the vector.
	 */
	public get magnitudeSquared(): number {
		return this.x ** 2 + this.y ** 2;
	}

	/**
	 * Gets the angle of this vector in radians.
	 * Returns a value between -π and π.
	 *
	 * @returns The angle in radians.
	 */
	public get angle(): number {
		return Math.atan2(this.y, this.x);
	}

	/**
	 * Sets the angle of this vector while preserving its magnitude.
	 * Rotates the vector to the specified angle.
	 *
	 * @param value - The desired angle in radians.
	 */
	public set angle(value: number) {
		const magnitude = this.magnitude;

		this.x = magnitude * Math.cos(value);
		this.y = magnitude * Math.sin(value);
	}

	/**
	 * Checks if this is a null vector (both components are zero).
	 *
	 * @returns True if both x and y are zero.
	 */
	public get isNull(): boolean {
		return this.x === 0 && this.y === 0;
	}

	/**
	 * Gets the vector components as a tuple [x, y].
	 *
	 * @returns An array containing the x and y components.
	 */
	public get xy(): [number, number] {
		return [this.x, this.y];
	}

	/**
	 * Sets the vector components from a tuple [x, y].
	 *
	 * @param value - An array containing the x and y components.
	 */
	public set xy(value: [number, number]) {
		this.x = value[0];
		this.y = value[1];
	}

	/**
	 * Gets the maximum component value (either x or y).
	 *
	 * @returns The larger of the x or y components.
	 */
	public get max(): number {
		return Math.max(this.x, this.y);
	}

	/**
	 * Gets the minimum component value (either x or y).
	 *
	 * @returns The smaller of the x or y components.
	 */
	public get min(): number {
		return Math.min(this.x, this.y);
	}
}

class ObservableVector2 extends Vector2 {
	private storedX: number;
	private storedY: number;

	/**
	 * Creates a new 2D vector using Cartesian coordinates.
	 *
	 * @param x - X-coordinate (defaults to 0).
	 * @param y - Y-coordinate (defaults to x if omitted).
	 *
	 * @example
	 * new Vector2D() // (0, 0)
	 * new Vector2D(5) // (5, 5)
	 * new Vector2D(3, 4) // (3, 4)
	 */
	public constructor(x?: number, y?: number);

	/**
	 * Creates a new 2D vector using polar coordinates.
	 *
	 * @param angle - Angle in radians.
	 * @param length - Magnitude (distance from origin).
	 * @param polar - Must be `true` to use this overload.
	 *
	 * @example
	 * new Vector2D(Math.PI / 4, 10, true) // Angle π/4, magnitude 10
	 */
	public constructor(angle: number, length: number, polar: true);

	public constructor(a: number = 0, b: number = a, polar: boolean = false) {
		super(a, b, polar as any);

		this.storedX = this.x;
		this.storedY = this.y;
	}

	/**
	 * Stores the current x value for change detection.
	 *
	 * @returns The current instance for chaining.
	 */
	public storeX(): this {
		this.storedX = this.x;

		return this;
	}

	/**
	 * Stores the current y value for change detection.
	 *
	 * @returns The current instance for chaining.
	 */
	public storeY(): this {
		this.storedY = this.y;

		return this;
	}

	/**
	 * Stores the current x and y values for change detection.
	 *
	 * @param x Whether to store the x value.
	 * @param y Whether to store the y value.
	 * @returns The current instance for chaining.
	 */

	public store(x: boolean = true, y: boolean = true): this {
		if (x) {
			this.storeX();
		}

		if (y) {
			this.storeY();
		}

		return this;
	}

	/**
	 * Checks if the x value has been updated since the last store.
	 *
	 * @param minimumDelta  The minimum change to consider as updated.
	 * @returns Wether the x value has been updated.
	 */
	public hasUpdatedX(minimumDelta: number = 0): boolean {
		return Math.abs(this.x - this.storedX) > minimumDelta;
	}

	/**
	 * Checks if the y value has been updated since the last store.
	 *
	 * @param minimumDelta The minimum change to consider as updated.
	 * @returns Wether the y value has been updated.
	 */
	public hasUpdatedY(minimumDelta: number = 0): boolean {
		return Math.abs(this.y - this.storedY) > minimumDelta;
	}

	/**
	 * Checks if the vector has been updated since the last store.
	 *
	 * @param x Whether to check the x value.
	 * @param y Whether to check the y value.
	 * @returns True if the vector has been updated.
	 */

	public hasUpdated(minimumDelta: number = 0): boolean {
		if (this.hasUpdatedX(minimumDelta)) {
			return true;
		} else if (this.hasUpdatedY(minimumDelta)) {
			return true;
		}

		return false;
	}
}

export { Vector2, ObservableVector2, type Vector2Structure };
