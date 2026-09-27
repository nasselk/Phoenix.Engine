/** Anything with x, y, z and w: a Rapier rotation, a three.js quaternion, or a `Quaternion`. */
export type QuaternionStructure = { x: number; y: number; z: number; w: number };

/** Largest a component other than the biggest can be in a unit quaternion: 1/√2. */
const SMALLEST_RANGE = Math.SQRT1_2;
const COMPONENT_BITS = 10;
const COMPONENT_MASK = (1 << COMPONENT_BITS) - 1;
/** Steps on each side of zero, so that zero itself is exact. */
const COMPONENT_STEPS = (1 << (COMPONENT_BITS - 1)) - 1;

/** Below this angle apart, two rotations are blended linearly: slerp's division is unstable there. */
const SLERP_THRESHOLD = 1e-4;

/**
 * Euler angles applied yaw, then pitch, then roll — the order entities are drawn in — as a quaternion,
 * without allocating.
 */
export function eulerToQuaternion<Q extends QuaternionStructure>(pitch: number, yaw: number, roll: number, out: Q): Q {
	const c1 = Math.cos(pitch / 2);
	const c2 = Math.cos(yaw / 2);
	const c3 = Math.cos(roll / 2);
	const s1 = Math.sin(pitch / 2);
	const s2 = Math.sin(yaw / 2);
	const s3 = Math.sin(roll / 2);

	out.x = s1 * c2 * c3 + c1 * s2 * s3;
	out.y = c1 * s2 * c3 - s1 * c2 * s3;
	out.z = c1 * c2 * s3 - s1 * s2 * c3;
	out.w = c1 * c2 * c3 + s1 * s2 * s3;

	return out;
}

/** The inverse of `eulerToQuaternion`: `[pitch, yaw, roll]` from a unit quaternion. */
export function quaternionToEuler({ x, y, z, w }: QuaternionStructure, out: [number, number, number]): [number, number, number] {
	const m11 = 1 - 2 * (y * y + z * z);
	const m13 = 2 * (x * z + w * y);
	const m21 = 2 * (x * y + w * z);
	const m22 = 1 - 2 * (x * x + z * z);
	const m23 = 2 * (y * z - w * x);
	const m31 = 2 * (x * z - w * y);
	const m33 = 1 - 2 * (x * x + y * y);

	out[0] = Math.asin(-Math.max(-1, Math.min(1, m23)));

	// Looking straight up or down, yaw and roll turn about the same axis, so yaw takes all of it.
	if (Math.abs(m23) < 0.9999999) {
		out[1] = Math.atan2(m13, m33);
		out[2] = Math.atan2(m21, m22);
	} else {
		out[1] = Math.atan2(-m31, m11);
		out[2] = 0;
	}

	return out;
}

/**
 * A rotation, as a unit quaternion. `q` and `-q` are the same rotation: every comparison here treats
 * them as equal, and every blend takes the shorter way round.
 */
class Quaternion {
	public static readonly IDENTITY: Quaternion = Object.freeze(new Quaternion());

	public static readonly TEMP1: Quaternion = new Quaternion();
	public static readonly TEMP2: Quaternion = new Quaternion();

	public x: number;
	public y: number;
	public z: number;
	public w: number;

	public constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}

	public set(quaternion: QuaternionStructure): this;
	public set(x: number, y: number, z: number, w: number): this;

	public set(a: QuaternionStructure | number, y?: number, z?: number, w?: number): this {
		if (typeof a === "object") {
			this.x = a.x;
			this.y = a.y;
			this.z = a.z;
			this.w = a.w;
		} else {
			this.x = a;
			this.y = y!;
			this.z = z!;
			this.w = w!;
		}

		return this;
	}

	/** Yaw, then pitch, then roll, in radians. */
	public setFromEuler(pitch: number, yaw: number, roll: number): this {
		return eulerToQuaternion(pitch, yaw, roll, this);
	}

	/** A turn of `yaw` radians about the vertical axis, and nothing else. */
	public setFromYaw(yaw: number): this {
		return this.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
	}

	/** `angle` radians about a unit `axis`. */
	public setFromAxisAngle(axis: { x: number; y: number; z: number }, angle: number): this {
		const sin = Math.sin(angle / 2);

		return this.set(axis.x * sin, axis.y * sin, axis.z * sin, Math.cos(angle / 2));
	}

	/** `[pitch, yaw, roll]`, in the order `setFromEuler` takes them. */
	public toEuler(out: [number, number, number] = [0, 0, 0]): [number, number, number] {
		return quaternionToEuler(this, out);
	}

	/** Which way it faces on the ground: the yaw of `toEuler`, without the rest. */
	public get yaw(): number {
		const { x, y, z, w } = this;

		return Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
	}

	public dot(quaternion: QuaternionStructure): number {
		return this.x * quaternion.x + this.y * quaternion.y + this.z * quaternion.z + this.w * quaternion.w;
	}

	/** How far apart two rotations are, in radians, from 0 to π. */
	public angleTo(quaternion: QuaternionStructure): number {
		return 2 * Math.acos(Math.min(1, Math.abs(this.dot(quaternion))));
	}

	public equals(quaternion: QuaternionStructure, epsilon: number = 0): boolean {
		return this.angleTo(quaternion) <= epsilon;
	}

	public length(): number {
		return Math.hypot(this.x, this.y, this.z, this.w);
	}

	public normalize(): this {
		const length = this.length();

		if (length === 0) {
			return this.set(0, 0, 0, 1);
		}

		this.x /= length;
		this.y /= length;
		this.z /= length;
		this.w /= length;

		return this;
	}

	/** The rotation that undoes this one. */
	public invert(): this {
		this.x = -this.x;
		this.y = -this.y;
		this.z = -this.z;

		return this;
	}

	/** This rotation, then `quaternion` applied in its frame: `this = this × quaternion`. */
	public multiply(quaternion: QuaternionStructure): this {
		const { x: ax, y: ay, z: az, w: aw } = this;
		const { x: bx, y: by, z: bz, w: bw } = quaternion;

		this.x = ax * bw + aw * bx + ay * bz - az * by;
		this.y = ay * bw + aw * by + az * bx - ax * bz;
		this.z = az * bw + aw * bz + ax * by - ay * bx;
		this.w = aw * bw - ax * bx - ay * by - az * bz;

		return this;
	}

	/** `quaternion` first, then this rotation: `this = quaternion × this`. */
	public premultiply(quaternion: QuaternionStructure): this {
		const { x: ax, y: ay, z: az, w: aw } = quaternion;
		const { x: bx, y: by, z: bz, w: bw } = this;

		this.x = ax * bw + aw * bx + ay * bz - az * by;
		this.y = ay * bw + aw * by + az * bx - ax * bz;
		this.z = az * bw + aw * bz + ax * by - ay * bx;
		this.w = aw * bw - ax * bx - ay * by - az * bz;

		return this;
	}

	/** Turn a fraction `t` of the way to `target`, the shorter way round, at a constant rate. */
	public slerp(target: QuaternionStructure, t: number): this {
		let { x, y, z, w } = target;
		let cos = this.dot(target);

		if (cos < 0) {
			x = -x;
			y = -y;
			z = -z;
			w = -w;
			cos = -cos;
		}

		let from = 1 - t;
		let to = t;

		if (1 - cos > SLERP_THRESHOLD) {
			const angle = Math.acos(cos);
			const sin = Math.sin(angle);

			from = Math.sin(from * angle) / sin;
			to = Math.sin(to * angle) / sin;
		}

		this.x = this.x * from + x * to;
		this.y = this.y * from + y * to;
		this.z = this.z * from + z * to;
		this.w = this.w * from + w * to;

		return this.normalize();
	}

	/**
	 * Four bytes: the largest component is dropped, since the others give it back, and the other three
	 * are kept to 10 bits each, under 2 bits saying which one was dropped. Off by 0.25° at most.
	 */
	public pack(): number {
		const components = [this.x, this.y, this.z, this.w];

		let largest = 0;

		for (let i = 1; i < 4; i++) {
			if (Math.abs(components[i]!) > Math.abs(components[largest]!)) {
				largest = i;
			}
		}

		const sign = components[largest]! < 0 ? -1 : 1;

		let packed = largest;

		for (let i = 0; i < 4; i++) {
			if (i !== largest) {
				const value = (components[i]! * sign) / SMALLEST_RANGE;
				const quantized = Math.round(Math.max(-1, Math.min(1, value)) * COMPONENT_STEPS) + COMPONENT_STEPS;

				packed = packed * (COMPONENT_MASK + 1) + quantized;
			}
		}

		return packed >>> 0;
	}

	/** Read back what `pack` wrote. */
	public unpack(packed: number): this {
		const largest = packed >>> (3 * COMPONENT_BITS);
		const components = [0, 0, 0, 0];

		let sum = 0;
		let shift = 2 * COMPONENT_BITS;

		for (let i = 0; i < 4; i++) {
			if (i !== largest) {
				const quantized = (packed >>> shift) & COMPONENT_MASK;
				const value = ((quantized - COMPONENT_STEPS) / COMPONENT_STEPS) * SMALLEST_RANGE;

				components[i] = value;
				sum += value * value;
				shift -= COMPONENT_BITS;
			}
		}

		components[largest] = Math.sqrt(Math.max(0, 1 - sum));

		return this.set(components[0]!, components[1]!, components[2]!, components[3]!).normalize();
	}

	public clone(): Quaternion {
		return new Quaternion(this.x, this.y, this.z, this.w);
	}
}

/** A quaternion that remembers the last value `store` saw, to tell whether it has turned since. */
class ObservableQuaternion extends Quaternion {
	private readonly stored: Quaternion;

	public constructor(x?: number, y?: number, z?: number, w?: number) {
		super(x, y, z, w);

		this.stored = new Quaternion(this.x, this.y, this.z, this.w);
	}

	public store(): this {
		this.stored.set(this);

		return this;
	}

	/** Whether it turned more than `minimumAngle` radians since the last `store`. */
	public hasUpdated(minimumAngle: number = 0): boolean {
		return this.angleTo(this.stored) > minimumAngle;
	}
}

export { ObservableQuaternion, Quaternion };
