import { clamp } from "./utils.js";

/**
 * Represents a simple 3D point or vector with x, y and z coordinates.
 * This is a structural type that can be satisfied by any object with x, y and z properties.
 * Use this for parameters that accept duck-typed vector-like objects.
 */
type Vector3DStructure = { x: number; y: number; z: number };

/**
 * A 3D vector class providing vector mathematics operations.
 * Supports both Cartesian (x, y, z) and spherical (azimuth, elevation, magnitude) coordinate systems.
 */
class Vector3D {
	/**
	 * A constant null vector at origin (0, 0, 0).
	 *
	 * @remarks
	 * This is a frozen object and cannot be modified.
	 * Use this as a default value for rotation centers or origin points.
	 *
	 * @example
	 * // Rotate around origin
	 * vec.rotate(Math.PI / 2, axis, Vector3D.NULL);
	 */
	public static readonly NULL: Vector3D = Object.freeze(new Vector3D());

	/**
	 * A temporary vector instance for calculations to avoid creating new objects.
	 *
	 * @remarks
	 * This vector is mutable and should be used carefully to avoid unintended side effects.
	 *
	 * @example
	 * // Use TEMP1 for intermediate calculations
	 * const result = Vector3D.TEMP1.set(vec1).add(vec2);
	 */
	public static readonly TEMP1: Vector3D = new Vector3D();
	public static readonly TEMP2: Vector3D = new Vector3D();
	public static readonly TEMP3: Vector3D = new Vector3D();
	public static readonly TEMP4: Vector3D = new Vector3D();
	public static readonly TEMP5: Vector3D = new Vector3D();

	/** The x-coordinate of the vector. */
	public x: number;

	/** The y-coordinate of the vector. */
	public y: number;

	/** The z-coordinate of the vector. */
	public z: number;

	/**
	 * Creates a new 3D vector using Cartesian coordinates.
	 *
	 * @param x - X-coordinate (defaults to 0).
	 * @param y - Y-coordinate (defaults to x if omitted).
	 * @param z - Z-coordinate (defaults to y if omitted).
	 *
	 * @example
	 * new Vector3D() // (0, 0, 0)
	 * new Vector3D(5) // (5, 5, 5)
	 * new Vector3D(3, 4, 5) // (3, 4, 5)
	 */
	public constructor(x?: number, y?: number, z?: number);

	/**
	 * Creates a new 3D vector using spherical coordinates.
	 *
	 * @param azimuth - Angle around the z-axis in radians, measured in the xy-plane.
	 * @param elevation - Angle away from the xy-plane in radians.
	 * @param length - Magnitude (distance from origin).
	 * @param polar - Must be `true` to use this overload.
	 *
	 * @example
	 * new Vector3D(Math.PI / 4, 0, 10, true) // Azimuth π/4, in the xy-plane, magnitude 10
	 */
	public constructor(azimuth: number, elevation: number, length: number, polar: true);

	public constructor(a: number = 0, b: number = a, c: number = b, polar: boolean = false) {
		if (polar) {
			this.x = c * Math.cos(b) * Math.cos(a);
			this.y = c * Math.cos(b) * Math.sin(a);
			this.z = c * Math.sin(b);
		} else {
			this.x = a;
			this.y = b;
			this.z = c;
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
	public set(vector: Vector3DStructure, scalar?: number): this;

	/**
	 * Sets this vector's x, y and z components.
	 *
	 * @param x - X-coordinate value.
	 * @param y - Y-coordinate value (defaults to x if omitted).
	 * @param z - Z-coordinate value (defaults to y if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.set(5) // Set to (5, 5, 5)
	 * vec.set(3, 4, 5) // Set to (3, 4, 5)
	 */
	public set(x: number, y?: number, z?: number): this;

	public set(a: Vector3DStructure | number, b?: number, c?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x = a.x * scalar;
			this.y = a.y * scalar;
			this.z = a.z * scalar;
		} else {
			this.x = a;
			this.y = b ?? a;
			this.z = c ?? this.y;
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
	public add(vector: Vector3DStructure, scalar?: number): this;

	/**
	 * Adds individual values to this vector's components.
	 *
	 * @param x - X-coordinate value to add.
	 * @param y - Y-coordinate value to add (defaults to x if omitted).
	 * @param z - Z-coordinate value to add (defaults to y if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.add(5) // Add 5 to all components
	 * vec.add(3, 4, 5) // Add (3, 4, 5)
	 */
	public add(x: number, y?: number, z?: number): this;

	public add(a: Vector3DStructure | number, b?: number, c?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x += a.x * scalar;
			this.y += a.y * scalar;
			this.z += a.z * scalar;
		} else {
			const y = b ?? a;

			this.x += a;
			this.y += y;
			this.z += c ?? y;
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
	public subtract(vector: Vector3DStructure, scalar?: number): this;

	/**
	 * Subtracts individual values from this vector's components.
	 *
	 * @param x - X-coordinate value to subtract.
	 * @param y - Y-coordinate value to subtract (defaults to x if omitted).
	 * @param z - Z-coordinate value to subtract (defaults to y if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.subtract(5) // Subtract 5 from all components
	 * vec.subtract(3, 4, 5) // Subtract (3, 4, 5)
	 */
	public subtract(x: number, y?: number, z?: number): this;

	public subtract(a: Vector3DStructure | number, b?: number, c?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x -= a.x * scalar;
			this.y -= a.y * scalar;
			this.z -= a.z * scalar;
		} else {
			const y = b ?? a;

			this.x -= a;
			this.y -= y;
			this.z -= c ?? y;
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
	public multiply(vector: Vector3DStructure, scalar?: number): this;

	/**
	 * Multiplies this vector's components by individual values.
	 *
	 * @param x - X-coordinate multiplier.
	 * @param y - Y-coordinate multiplier (defaults to x if omitted).
	 * @param z - Z-coordinate multiplier (defaults to y if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.multiply(2) // Scale by 2
	 * vec.multiply(2, 3, 4) // Multiply x by 2, y by 3, z by 4
	 */
	public multiply(x: number, y?: number, z?: number): this;

	public multiply(a: Vector3DStructure | number, b?: number, c?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x *= a.x * scalar;
			this.y *= a.y * scalar;
			this.z *= a.z * scalar;
		} else {
			const y = b ?? a;

			this.x *= a;
			this.y *= y;
			this.z *= c ?? y;
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
	public divide(vector: Vector3DStructure, scalar?: number): this;

	/**
	 * Divides this vector's components by individual values.
	 *
	 * @param x - X-coordinate divisor.
	 * @param y - Y-coordinate divisor (defaults to x if omitted).
	 * @param z - Z-coordinate divisor (defaults to y if omitted).
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * vec.divide(2) // Divide by 2
	 * vec.divide(2, 4, 8) // Divide x by 2, y by 4, z by 8
	 */
	public divide(x: number, y?: number, z?: number): this;

	public divide(a: Vector3DStructure | number, b?: number, c?: number): this {
		if (typeof a === "object") {
			const scalar = b ?? 1;

			this.x /= a.x * scalar;
			this.y /= a.y * scalar;
			this.z /= a.z * scalar;
		} else {
			if (a === 0) {
				throw new Error("Division by zero in vector division with x component");
			} else if (b === 0) {
				throw new Error("Division by zero in vector division with y component");
			} else if (c === 0) {
				throw new Error("Division by zero in vector division with z component");
			}

			const y = b ?? a;

			this.x /= a;
			this.y /= y;
			this.z /= c ?? y;
		}

		return this;
	}

	/**
	 * Scales this vector by a scalar value.
	 * Alias for `multiply(scalar)`.
	 *
	 * @param scalar - The scalar value to multiply all components by.
	 * @returns This vector for method chaining.
	 */
	public scale(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;

		return this;
	}

	/**
	 * Adds a displacement in a specific direction (spherical coordinates).
	 * More efficient than creating a spherical vector for one-time directional movement.
	 *
	 * @param azimuth - The angle in radians around the z-axis, measured in the xy-plane.
	 * @param elevation - The angle in radians away from the xy-plane.
	 * @param distance - The distance to move in that direction.
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * // Move 10 units to the right (0 radians)
	 * position.addDirection(0, 0, 10);
	 *
	 * // Move 5 units straight up
	 * position.addDirection(0, Math.PI / 2, 5);
	 */
	public addDirection(azimuth: number, elevation: number, distance: number): this {
		this.x += distance * Math.cos(elevation) * Math.cos(azimuth);
		this.y += distance * Math.cos(elevation) * Math.sin(azimuth);
		this.z += distance * Math.sin(elevation);

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
	 * // Set this vector to the midpoint of it and (5, 5, 5)
	 * position.interpolate(new Vector3D(5, 5, 5), 0.5);
	 *
	 * // Move this vector 10% of the way to (1, 2, 3)
	 * position.addDirection(new Vector3D(1, 2, 3), 0.1);
	 */
	public interpolate(otherVec: Vector3D, t: number) {
		this.x += (otherVec.x - this.x) * t;
		this.y += (otherVec.y - this.y) * t;
		this.z += (otherVec.z - this.z) * t;

		return this;
	}

	/**
	 * Sets this vector to a specific direction and distance from the origin.
	 *
	 * @param azimuth - The angle in radians around the z-axis, measured in the xy-plane.
	 * @param elevation - The angle in radians away from the xy-plane.
	 * @param distance - The distance from the origin.
	 * @returns This vector for method chaining.
	 *
	 * @example
	 * // Set to 10 units to the right (0 radians)
	 * position.setDirection(0, 0, 10);
	 *
	 * // Set to 5 units straight up
	 * position.setDirection(0, Math.PI / 2, 5);
	 */

	public setDirection(azimuth: number, elevation: number, distance: number): this {
		this.x = distance * Math.cos(elevation) * Math.cos(azimuth);
		this.y = distance * Math.cos(elevation) * Math.sin(azimuth);
		this.z = distance * Math.sin(elevation);

		return this;
	}

	/**
	 * Calculates the dot product of this vector with another.
	 * Useful for determining the angle between vectors or projecting one vector onto another.
	 *
	 * @param vector - The vector to calculate the dot product with.
	 * @returns The dot product (scalar value).
	 */
	public dot(vector: Vector3DStructure): number {
		return this.x * vector.x + this.y * vector.y + this.z * vector.z;
	}

	/**
	 * Calculates the cross product of this vector with another.
	 * Returns a vector perpendicular to both, following the right-hand rule.
	 *
	 * @param vector - The vector to calculate the cross product with.
	 * @returns A new Vector3D perpendicular to both vectors.
	 */
	public cross(vector: Vector3DStructure): Vector3D {
		return new Vector3D(this.y * vector.z - this.z * vector.y, this.z * vector.x - this.x * vector.z, this.x * vector.y - this.y * vector.x);
	}

	/**
	 * Calculates the vector difference from this vector to another.
	 *
	 * @param vector - The target vector to calculate the difference to.
	 * @returns A new Vector3D representing the difference (this - vector).
	 *
	 * @example
	 * const a = new Vector3D(3, 4, 5);
	 * const b = new Vector3D(1, 2, 3);
	 * const delta = a.delta(b); // delta is (2, 2, 2)
	 */
	public delta(vector: Vector3DStructure): Vector3D {
		return new Vector3D(vector.x - this.x, vector.y - this.y, vector.z - this.z);
	}

	/**
	 * Calculates the midpoint between this vector and another.
	 *
	 * @param vector - The vector to calculate the midpoint with.
	 * @returns A new Vector3D representing the midpoint.
	 *
	 * @example
	 * const a = new Vector3D(0, 0, 0);
	 * const b = new Vector3D(4, 4, 4);
	 * const mid = a.midpoint(b); // mid is (2, 2, 2)
	 */
	public midpoint(vector: Vector3DStructure): Vector3D {
		return new Vector3D((this.x + vector.x) / 2, (this.y + vector.y) / 2, (this.z + vector.z) / 2);
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
	 * Rotates this vector by the specified angle around an axis through a point.
	 *
	 * @param angle - The rotation angle in radians (counter-clockwise around the axis, right-hand rule).
	 * @param axis - The axis to rotate around (does not need to be unit length).
	 * @param point - The point the axis passes through (defaults to origin).
	 * @returns This vector for method chaining.
	 */
	public rotate(angle: number, axis: Vector3DStructure, point: Vector3DStructure = Vector3D.NULL): this {
		const dx = this.x - point.x;
		const dy = this.y - point.y;
		const dz = this.z - point.z;

		const length = Math.sqrt(axis.x ** 2 + axis.y ** 2 + axis.z ** 2);

		if (length === 0) {
			return this;
		}

		const kx = axis.x / length;
		const ky = axis.y / length;
		const kz = axis.z / length;

		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		const dot = kx * dx + ky * dy + kz * dz;

		const x = dx * cos + (ky * dz - kz * dy) * sin + kx * dot * (1 - cos);
		const y = dy * cos + (kz * dx - kx * dz) * sin + ky * dot * (1 - cos);
		const z = dz * cos + (kx * dy - ky * dx) * sin + kz * dot * (1 - cos);

		this.x = x + point.x;
		this.y = y + point.y;
		this.z = z + point.z;

		return this;
	}

	/**
	 * Calculates the Euclidean distance from this vector to another point.
	 *
	 * @param vector - The point to calculate distance to.
	 * @returns The distance between the two points.
	 */
	public distance(vector: Vector3DStructure): number {
		const dx = this.x - vector.x;
		const dy = this.y - vector.y;
		const dz = this.z - vector.z;

		return Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
	}

	/**
	 * Calculates the squared distance from this vector to another point.
	 * More efficient than `distance()` when only comparing distances.
	 *
	 * @param vector - The point to calculate squared distance to.
	 * @returns The squared distance between the two points.
	 */
	public distanceSquared(vector: Vector3DStructure): number {
		const dx = this.x - vector.x;
		const dy = this.y - vector.y;
		const dz = this.z - vector.z;

		return dx ** 2 + dy ** 2 + dz ** 2;
	}

	/**
	 * Calculates the azimuth from this vector to another point in radians.
	 * This is the angle around the z-axis, measured in the xy-plane, between -π and π.
	 *
	 * @param vector - The point to calculate the azimuth to.
	 * @returns The angle in radians.
	 */
	public azimuthTo(vector: Vector3DStructure): number {
		const dx = vector.x - this.x;
		const dy = vector.y - this.y;

		return Math.atan2(dy, dx);
	}

	/**
	 * Calculates the elevation from this vector to another point in radians.
	 * This is the angle away from the xy-plane, between -π/2 and π/2.
	 *
	 * @param vector - The point to calculate the elevation to.
	 * @returns The angle in radians.
	 */
	public elevationTo(vector: Vector3DStructure): number {
		const dx = vector.x - this.x;
		const dy = vector.y - this.y;
		const dz = vector.z - this.z;

		return Math.atan2(dz, Math.sqrt(dx ** 2 + dy ** 2));
	}

	/**
	 * Calculates the shortest distance from this point to a line segment.
	 *
	 * @param p1 - First endpoint of the line segment.
	 * @param p2 - Second endpoint of the line segment.
	 * @returns The shortest distance to the line segment.
	 */
	public segmentDistance(p1: Vector3D, p2: Vector3D): number {
		const projection = this.projectOnSegment(p1, p2);

		return this.distance(projection);
	}

	/**
	 * Projects this point onto a line segment, clamped between the endpoints.
	 * Returns the closest point on the segment to this point.
	 *
	 * @param p1 - First endpoint of the line segment.
	 * @param p2 - Second endpoint of the line segment.
	 * @returns A new Vector3D representing the closest point on the segment.
	 */
	public projectOnSegment(p1: Vector3D, p2: Vector3D): Vector3D {
		const ab = p2.clone().subtract(p1);
		const t = clamp(this.clone().subtract(p1).dot(ab) / ab.magnitudeSquared, 0, 1);
		return p1.clone().add(ab.scale(t));
	}

	/**
	 * Projects this point onto a line segment.
	 * Returns the closest point on the segment to this point.
	 *
	 * @param p - A vector defining the line segment.
	 * @returns A new Vector3D representing the closest point on the segment.
	 */
	public project(p: Vector3D): Vector3D {
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
	public reflect(normal: Vector3DStructure): this {
		const dotProduct = this.dot(normal);

		return this.subtract(normal, 2 * dotProduct);
	}

	/**
	 * Checks if this vector is exactly equal to certain values.
	 *
	 * @param x - The x-coordinate to compare against.
	 * @param y - The y-coordinate to compare against.
	 * @param z - The z-coordinate to compare against.
	 * @returns True if the x, y and z components are equal.
	 */
	public equals(x: number, y?: number, z?: number): boolean;

	/**
	 * Checks if this vector is exactly equal to another.
	 *
	 * @param vector - The vector to compare against.
	 * @returns True if the x, y and z components are equal.
	 */
	public equals(vector: Vector3DStructure): boolean;

	public equals(a: Vector3DStructure | number, b?: number, c?: number): boolean {
		if (typeof a === "object") {
			return this.x === a.x && this.y === a.y && this.z === a.z;
		} else {
			b ??= a;
			c ??= b;

			return this.x === a && this.y === b && this.z === c;
		}
	}

	/**
	 * Returns a string representation of this vector.
	 *
	 * @returns A string in the format "Vector3(x, y, z)".
	 */
	public toString(): string {
		return `Vector3(${this.x}, ${this.y}, ${this.z})`;
	}

	/**
	 * Creates a new vector with the same components as this one.
	 *
	 * @returns A new Vector3D instance with the same x, y and z values.
	 */
	public clone(): Vector3D {
		return new Vector3D(this.x, this.y, this.z);
	}

	/**
	 * Gets the length (magnitude) of this vector.
	 *
	 * @returns The magnitude of the vector.
	 */
	public get magnitude(): number {
		return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
	}

	/**
	 * Sets the length (magnitude) of this vector while preserving its direction.
	 * Scales the vector to the specified length.
	 *
	 * @param value - The desired magnitude (length) of the vector.
	 * @throws {Error} If attempting to set the magnitude of a null vector (magnitude of 0).
	 *
	 * @example
	 * const vec = new Vector3D(2, 3, 6); // magnitude is 7
	 * vec.magnitude = 14; // Now magnitude is 14, direction unchanged
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
		return this.x ** 2 + this.y ** 2 + this.z ** 2;
	}

	/**
	 * Gets the azimuth of this vector in radians.
	 * This is the angle around the z-axis, measured in the xy-plane, between -π and π.
	 *
	 * @returns The angle in radians.
	 */
	public get azimuth(): number {
		return Math.atan2(this.y, this.x);
	}

	/**
	 * Sets the azimuth of this vector while preserving its magnitude and elevation.
	 * Rotates the vector to the specified angle around the z-axis.
	 *
	 * @param value - The desired angle in radians.
	 */
	public set azimuth(value: number) {
		const planar = Math.sqrt(this.x ** 2 + this.y ** 2);

		this.x = planar * Math.cos(value);
		this.y = planar * Math.sin(value);
	}

	/**
	 * Gets the elevation of this vector in radians.
	 * This is the angle away from the xy-plane, between -π/2 and π/2.
	 *
	 * @returns The angle in radians.
	 */
	public get elevation(): number {
		return Math.atan2(this.z, Math.sqrt(this.x ** 2 + this.y ** 2));
	}

	/**
	 * Sets the elevation of this vector while preserving its magnitude and azimuth.
	 * Rotates the vector to the specified angle away from the xy-plane.
	 *
	 * @param value - The desired angle in radians.
	 */
	public set elevation(value: number) {
		const magnitude = this.magnitude;
		const azimuth = this.azimuth;
		const planar = magnitude * Math.cos(value);

		this.x = planar * Math.cos(azimuth);
		this.y = planar * Math.sin(azimuth);
		this.z = magnitude * Math.sin(value);
	}

	/**
	 * Checks if this is a null vector (all components are zero).
	 *
	 * @returns True if x, y and z are zero.
	 */
	public get isNull(): boolean {
		return this.x === 0 && this.y === 0 && this.z === 0;
	}

	/**
	 * Gets the vector components as a tuple [x, y, z].
	 *
	 * @returns An array containing the x, y and z components.
	 */
	public get xyz(): [number, number, number] {
		return [this.x, this.y, this.z];
	}

	/**
	 * Sets the vector components from a tuple [x, y, z].
	 *
	 * @param value - An array containing the x, y and z components.
	 */
	public set xyz(value: [number, number, number]) {
		this.x = value[0];
		this.y = value[1];
		this.z = value[2];
	}

	/**
	 * Gets the maximum component value (either x, y or z).
	 *
	 * @returns The largest of the x, y or z components.
	 */
	public get max(): number {
		return Math.max(this.x, this.y, this.z);
	}

	/**
	 * Gets the minimum component value (either x, y or z).
	 *
	 * @returns The smallest of the x, y or z components.
	 */
	public get min(): number {
		return Math.min(this.x, this.y, this.z);
	}
}

class ObservableVector3D extends Vector3D {
	private storedX: number;
	private storedY: number;
	private storedZ: number;

	/**
	 * Creates a new 3D vector using Cartesian coordinates.
	 *
	 * @param x - X-coordinate (defaults to 0).
	 * @param y - Y-coordinate (defaults to x if omitted).
	 * @param z - Z-coordinate (defaults to y if omitted).
	 *
	 * @example
	 * new Vector3D() // (0, 0, 0)
	 * new Vector3D(5) // (5, 5, 5)
	 * new Vector3D(3, 4, 5) // (3, 4, 5)
	 */
	public constructor(x?: number, y?: number, z?: number);

	/**
	 * Creates a new 3D vector using spherical coordinates.
	 *
	 * @param azimuth - Angle around the z-axis in radians, measured in the xy-plane.
	 * @param elevation - Angle away from the xy-plane in radians.
	 * @param length - Magnitude (distance from origin).
	 * @param polar - Must be `true` to use this overload.
	 *
	 * @example
	 * new Vector3D(Math.PI / 4, 0, 10, true) // Azimuth π/4, in the xy-plane, magnitude 10
	 */
	public constructor(azimuth: number, elevation: number, length: number, polar: true);

	public constructor(a: number = 0, b: number = a, c: number = b, polar: boolean = false) {
		super(a, b, c, polar as any);

		this.storedX = this.x;
		this.storedY = this.y;
		this.storedZ = this.z;
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
	 * Stores the current z value for change detection.
	 *
	 * @returns The current instance for chaining.
	 */
	public storeZ(): this {
		this.storedZ = this.z;

		return this;
	}

	/**
	 * Stores the current x, y and z values for change detection.
	 *
	 * @param x Whether to store the x value.
	 * @param y Whether to store the y value.
	 * @param z Whether to store the z value.
	 * @returns The current instance for chaining.
	 */

	public store(x: boolean = true, y: boolean = true, z: boolean = true): this {
		if (x) {
			this.storeX();
		}

		if (y) {
			this.storeY();
		}

		if (z) {
			this.storeZ();
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
	 * Checks if the z value has been updated since the last store.
	 *
	 * @param minimumDelta The minimum change to consider as updated.
	 * @returns Wether the z value has been updated.
	 */
	public hasUpdatedZ(minimumDelta: number = 0): boolean {
		return Math.abs(this.z - this.storedZ) > minimumDelta;
	}

	/**
	 * Checks if the vector has been updated since the last store.
	 *
	 * @param x Whether to check the x value.
	 * @param y Whether to check the y value.
	 * @param z Whether to check the z value.
	 * @returns True if the vector has been updated.
	 */

	public hasUpdated(minimumDelta: number = 0): boolean {
		if (this.hasUpdatedX(minimumDelta)) {
			return true;
		} else if (this.hasUpdatedY(minimumDelta)) {
			return true;
		} else if (this.hasUpdatedZ(minimumDelta)) {
			return true;
		}

		return false;
	}
}

export { Vector3D as Vector3, ObservableVector3D as ObservableVector3, type Vector3DStructure as Vector3Structure };
