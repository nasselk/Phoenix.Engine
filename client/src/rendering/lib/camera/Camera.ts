import { PerspectiveCamera, Vector3 } from "three";
import { clamp } from "../../../../../shared/math/utils";

export type OrbitTarget = { readonly x: number; readonly y: number; readonly z: number };

export type OrbitCameraOptions = Partial<{
	readonly fov: number;
	readonly near: number;
	readonly far: number;
	readonly yaw: number;
	readonly pitch: number;
	readonly distance: number;
	readonly minPitch: number;
	readonly maxPitch: number;
	readonly minDistance: number;
	readonly maxDistance: number;
	readonly rotateSpeed: number;
	readonly zoomSpeed: number;
	readonly dragging: boolean;
	readonly zooming: boolean;
	readonly minZoom: number;
	readonly maxZoom: number;
}>;

const WORLD_UP = new Vector3(0, 1, 0);

/** Longest step a single frame may fly, in seconds: a tab coming back from the background should not teleport. */
const MAX_FRAME = 0.1;

/**
 * A camera that orbits a target, or flies free once detached. Everything here is what a mouse and a
 * finger mean the same way: where the camera is, how far it turns, how close it gets.
 *
 * What differs is how a device says it, so the events belong to a subclass — `DesktopCamera` for a
 * mouse and a keyboard, `TouchCamera` for fingers. Both turn what they hear into `drag`, `pinchBy`
 * and `zoomBy`, which is all of this class they need.
 */
export abstract class OrbitCamera extends PerspectiveCamera {
	public target?: OrbitTarget;

	public yaw: number;
	public pitch: number;
	public distance: number;

	public minPitch: number;
	public maxPitch: number;
	public minDistance: number;
	public maxDistance: number;

	public rotateSpeed: number;
	public zoomSpeed: number;

	public dragging: boolean;
	public zooming: boolean;

	public minZoom: number;
	public maxZoom: number;

	/** What a subclass listens on, and what it lets go of when the camera is destroyed. */
	protected element?: HTMLElement | Window;

	/** Whether something is turning the camera right now, which a subclass sets as fingers or buttons go down. */
	protected orbiting = false;

	protected free = false;

	public constructor(options: OrbitCameraOptions = {}) {
		super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);

		this.yaw = options.yaw ?? 0;
		this.pitch = options.pitch ?? 0.6;
		this.distance = options.distance ?? 14;
		this.minPitch = options.minPitch ?? 0.1;
		this.maxPitch = options.maxPitch ?? 1.45;
		this.minDistance = options.minDistance ?? 4;
		this.maxDistance = options.maxDistance ?? 40;
		this.rotateSpeed = options.rotateSpeed ?? 0.0025;
		this.zoomSpeed = options.zoomSpeed ?? 0.001;
		this.dragging = options.dragging ?? true;
		this.zooming = options.zooming ?? true;
		this.minZoom = options.minZoom ?? 0.5;
		this.maxZoom = options.maxZoom ?? 10;
	}

	/** Whether the camera flies free instead of orbiting its target. */
	public get detached(): boolean {
		return this.free;
	}

	/**
	 * Detach to fly free from exactly where the camera is, or reattach to snap back to orbiting the
	 * target at the yaw, pitch and distance it had before.
	 */
	public setDetached(detached: boolean): this {
		this.free = detached;

		this.onDetached(detached);

		// The lens zoom belongs to free flight: attached, the camera zooms by its distance instead.
		if (!detached && this.zoom !== 1) {
			this.zoom = 1;
			this.updateProjectionMatrix();
		}

		return this;
	}

	public detach(): this {
		return this.setDetached(true);
	}

	public reattach(): this {
		return this.setDetached(false);
	}

	public toggleDetached(): this {
		return this.setDetached(!this.free);
	}

	/** Lens zoom, clamped to minZoom..maxZoom. Takes effect immediately. */
	public setZoom(zoom: number): this {
		this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
		this.updateProjectionMatrix();

		return this;
	}

	public get isOrbiting(): boolean {
		return this.orbiting;
	}

	public rotate(yaw: number, pitch: number): this {
		this.yaw += yaw;
		this.pitch = clamp(this.pitch + pitch, this.minPitch, this.maxPitch);

		return this;
	}

	public zoomBy(amount: number): this {
		this.distance = clamp(this.distance * Math.exp(amount), this.minDistance, this.maxDistance);

		return this;
	}

	/**
	 * Zoom by how much wider or narrower two fingers got: 2 is twice as close, 0.5 twice as far. Free,
	 * there is no target to close on, so the lens zooms instead, which is what the wheel does there too.
	 */
	public pinchBy(ratio: number): this {
		if (!this.zooming || ratio <= 0) {
			return this;
		}

		return this.free ? this.setZoom(this.zoom * ratio) : this.zoomBy(-Math.log(ratio));
	}

	public connect(element: HTMLElement | Window = window): this {
		this.destroy();

		this.element = element;

		this.listen(element);

		return this;
	}

	public destroy(): this {
		const element = this.element;

		if (element === undefined) {
			return this;
		}

		this.unlisten(element);

		this.element = undefined;
		this.orbiting = false;

		return this;
	}

	/** @param deltaTime Seconds since the last frame, which is how far a detached camera flies. */
	public update(deltaTime: number = 0): this {
		if (this.free) {
			this.fly(Math.min(deltaTime, MAX_FRAME));

			return this;
		}

		const target = this.target;

		if (target === undefined) {
			return this;
		}

		const flat = Math.cos(this.pitch) * this.distance;
		const { x, y, z } = target;

		this.position.set(x + Math.sin(this.yaw) * flat, y + Math.sin(this.pitch) * this.distance, z + Math.cos(this.yaw) * flat);
		this.lookAt(x, y, z);

		return this;
	}

	/** Start hearing this device's events. */
	protected abstract listen(element: HTMLElement | Window): void;

	protected abstract unlisten(element: HTMLElement | Window): void;

	/** Where a detached camera goes each frame. Nowhere, without something to fly it. */
	protected fly(_seconds: number): void {}

	/** Told when the camera detaches or comes back, for whatever a device was holding on to. */
	protected onDetached(_detached: boolean): void {}

	/**
	 * A drag of so many pixels, wherever it came from. Attached it swings around the target; free it
	 * turns the camera itself, divided by the lens zoom so the picture moves with the finger either way.
	 */
	protected drag(x: number, y: number): void {
		if (!this.dragging) {
			return;
		}

		if (this.free) {
			// No clamp and no lock: yaw turns around the world's up, pitch around the camera's own
			// sideways axis, both on the quaternion — so looking past straight up just carries on over.
			const speed = this.rotateSpeed / this.zoom;

			this.rotateOnWorldAxis(WORLD_UP, -x * speed);
			this.rotateX(-y * speed);

			return;
		}

		this.rotate(-x * this.rotateSpeed, y * this.rotateSpeed);
	}

	/** A wheel notch, or anything else that zooms by a distance rather than by a ratio. */
	protected zoomByDelta(delta: number): void {
		if (!this.zooming) {
			return;
		}

		if (this.free) {
			this.setZoom(this.zoom * Math.exp(-delta * this.zoomSpeed));
		} else {
			this.zoomBy(delta * this.zoomSpeed);
		}
	}
}
