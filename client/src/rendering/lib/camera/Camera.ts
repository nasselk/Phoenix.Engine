import type { Vector3Like } from "three";
import { normalizeAnglePI } from "../../../../../shared/math/angle";
import { clamp } from "../../../../../shared/math/utils";
import { ControlledCamera, type ControlledCameraOptions, ease } from "./ControlledCamera";

export type OrbitTarget = { readonly x: number; readonly y: number; readonly z: number };

export type OrbitCameraOptions = ControlledCameraOptions &
	Partial<{
		readonly yaw: number;
		readonly pitch: number;
		readonly distance: number;
		readonly minPitch: number;
		readonly maxPitch: number;
		readonly minDistance: number;
		readonly maxDistance: number;
		readonly dragging: boolean;
		readonly zooming: boolean;
	}>;

/**
 * A camera that orbits a target. Everything here is what a mouse and a finger mean the same way: where
 * the camera is, how far it turns, how close it gets. The editor flies a camera of its own (`EditorCamera`).
 *
 * What differs is how a device says it, so the events belong to a subclass — `DesktopCamera` for a
 * mouse and a keyboard, `TouchCamera` for fingers. Both turn what they hear into `drag`, `pinchBy`
 * and `zoomBy`, which is all of this class they need.
 */
export abstract class OrbitCamera extends ControlledCamera {
	public target?: OrbitTarget;

	public yaw: number;
	public pitch: number;
	public distance: number;

	public minPitch: number;
	public maxPitch: number;
	public minDistance: number;
	public maxDistance: number;

	public dragging: boolean;
	public zooming: boolean;

	/** Whether something is turning the camera right now, which a subclass sets as fingers or buttons go down. */
	protected orbiting = false;

	/** A `lookFrom` swing in progress: from which yaw and pitch to which, over how long, and how far along. */
	private readonly swing = { duration: 0, elapsed: 0, fromYaw: 0, toYaw: 0, fromPitch: 0, toPitch: 0 };

	public constructor(options: OrbitCameraOptions = {}) {
		super(options);

		this.yaw = options.yaw ?? 0;
		this.pitch = options.pitch ?? 0.6;
		this.distance = options.distance ?? 14;
		this.minPitch = options.minPitch ?? 0.1;
		this.maxPitch = options.maxPitch ?? 1.45;
		this.minDistance = options.minDistance ?? 4;
		this.maxDistance = options.maxDistance ?? 40;
		this.dragging = options.dragging ?? true;
		this.zooming = options.zooming ?? true;
	}

	public get isOrbiting(): boolean {
		return this.orbiting;
	}

	public rotate(yaw: number, pitch: number): this {
		this.yaw += yaw;
		this.pitch = clamp(this.pitch + pitch, this.minPitch, this.maxPitch);

		return this;
	}

	public override orbit(yaw: number, pitch: number): this {
		this.swing.duration = 0;

		return this.rotate(yaw, pitch);
	}

	/** Swing round its target to look from that side, the shortest way round, within its pitch limits. */
	public override lookFrom(direction: Vector3Like, seconds: number = 0): this {
		const { swing } = this;

		swing.fromYaw = this.yaw;
		swing.fromPitch = this.pitch;
		swing.toYaw = direction.x === 0 && direction.z === 0 ? this.yaw : this.yaw + normalizeAnglePI(Math.atan2(direction.x, direction.z) - this.yaw);
		swing.toPitch = clamp(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), this.minPitch, this.maxPitch);
		swing.elapsed = 0;
		swing.duration = seconds;

		if (seconds <= 0) {
			this.yaw = swing.toYaw;
			this.pitch = swing.toPitch;
		}

		return this;
	}

	public zoomBy(amount: number): this {
		this.distance = clamp(this.distance * Math.exp(amount), this.minDistance, this.maxDistance);

		return this;
	}

	/** Zoom by how much wider or narrower two fingers got: 2 is twice as close, 0.5 twice as far. */
	public pinchBy(ratio: number): this {
		if (!this.zooming || ratio <= 0) {
			return this;
		}

		return this.zoomBy(-Math.log(ratio));
	}

	public override destroy(): this {
		super.destroy();

		this.orbiting = false;

		return this;
	}

	protected override step(seconds: number): void {
		const { swing } = this;

		if (swing.duration > 0) {
			swing.elapsed = Math.min(swing.elapsed + seconds, swing.duration);

			if (swing.elapsed === swing.duration) {
				this.yaw = swing.toYaw;
				this.pitch = swing.toPitch;
				swing.duration = 0;
			} else {
				const eased = ease(swing.elapsed / swing.duration);

				this.yaw = swing.fromYaw + (swing.toYaw - swing.fromYaw) * eased;
				this.pitch = swing.fromPitch + (swing.toPitch - swing.fromPitch) * eased;
			}
		}

		const target = this.target;

		if (target === undefined) {
			return;
		}

		if (this.turn !== 0 || this.tilt !== 0) {
			this.rotate(-this.turn * this.turnSpeed * seconds, -this.tilt * this.tiltSpeed * seconds);
		}

		const flat = Math.cos(this.pitch) * this.distance;
		const { x, y, z } = target;

		this.position.set(x + Math.sin(this.yaw) * flat, y + Math.sin(this.pitch) * this.distance, z + Math.cos(this.yaw) * flat);
		this.lookAt(x, y, z);
	}

	/** A drag of so many pixels, wherever it came from: it swings the camera around its target. */
	protected drag(x: number, y: number): void {
		if (!this.dragging) {
			return;
		}

		this.orbit(-x * this.rotateSpeed, y * this.rotateSpeed);
	}

	/** A wheel notch, or anything else that zooms by a distance rather than by a ratio. */
	protected zoomByDelta(delta: number): void {
		if (!this.zooming) {
			return;
		}

		this.zoomBy(delta * this.zoomSpeed);
	}
}
