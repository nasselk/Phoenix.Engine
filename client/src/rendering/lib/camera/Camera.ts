import { PerspectiveCamera } from "three";
import { clamp } from "../../../../../shared/math/utils";

export type OrbitTarget = { readonly x: number; readonly y: number; readonly z: number };

export type OrbitCameraOptions = Partial<{
	/** The vertical field of view the game is designed for, in degrees. */
	readonly fov: number;
	/**
	 * The narrowest the horizontal field of view may get, in degrees: on a screen narrower than that
	 * allows, as a phone held upright, the view widens rather than cutting the sides off. 0 turns it off.
	 */
	readonly minHorizontalFov: number;
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
	readonly turnSpeed: number;
	readonly tiltSpeed: number;
	readonly zoomSpeed: number;
	readonly dragging: boolean;
	readonly zooming: boolean;
}>;

/** Longest step a single frame may turn, in seconds: a tab coming back from the background should not swing round. */
const MAX_FRAME = 0.1;

/**
 * A camera that orbits a target. Everything here is what a mouse and a finger mean the same way: where
 * the camera is, how far it turns, how close it gets. The editor flies a camera of its own (`EditorCamera`).
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

	/**
	 * Turns the camera around its target every frame, like a mouse dragged sideways: -1 to the left, 1 to
	 * the right, 0 still. Set from held keys, a gamepad stick, anything; the camera does not read input itself.
	 */
	public turn = 0;
	/** How fast `turn` at 1 goes round, in radians per second. */
	public turnSpeed: number;

	/** Tilts the camera every frame, like a mouse dragged up or down: 1 looks up, -1 looks down, 0 still. */
	public tilt = 0;
	/** How fast `tilt` at 1 tilts, in radians per second. */
	public tiltSpeed: number;

	public dragging: boolean;
	public zooming: boolean;

	/** What a subclass listens on, and what it lets go of when the camera is destroyed. */
	protected element?: HTMLElement | Window;

	/** Whether something is turning the camera right now, which a subclass sets as fingers or buttons go down. */
	protected orbiting = false;

	private verticalFovDegrees: number;
	private minHorizontalFovDegrees: number;

	public constructor(options: OrbitCameraOptions = {}) {
		super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);

		this.verticalFovDegrees = this.fov;
		this.minHorizontalFovDegrees = options.minHorizontalFov ?? 60;

		this.yaw = options.yaw ?? 0;
		this.pitch = options.pitch ?? 0.6;
		this.distance = options.distance ?? 14;
		this.minPitch = options.minPitch ?? 0.1;
		this.maxPitch = options.maxPitch ?? 1.45;
		this.minDistance = options.minDistance ?? 4;
		this.maxDistance = options.maxDistance ?? 40;
		this.rotateSpeed = options.rotateSpeed ?? 0.0025;
		this.turnSpeed = options.turnSpeed ?? 2.5;
		this.tiltSpeed = options.tiltSpeed ?? 1.5;
		this.zoomSpeed = options.zoomSpeed ?? 0.001;
		this.dragging = options.dragging ?? true;
		this.zooming = options.zooming ?? true;
	}

	/**
	 * Match a canvas of that shape: the vertical field of view the game asked for, widened when the
	 * screen is too narrow to show `minHorizontalFov` across. What the renderer calls on every resize.
	 */
	public fit(aspect: number = this.aspect): this {
		const narrowest = this.minHorizontalFovDegrees;
		const needed = narrowest > 0 ? 2 * Math.atan(Math.tan((narrowest * Math.PI) / 360) / aspect) * (180 / Math.PI) : 0;

		this.aspect = aspect;
		this.fov = Math.max(this.verticalFovDegrees, needed);
		this.updateProjectionMatrix();

		return this;
	}

	/** The vertical field of view the game is designed for, in degrees; the one shown unless the screen is too narrow. */
	public get verticalFov(): number {
		return this.verticalFovDegrees;
	}

	public set verticalFov(degrees: number) {
		this.verticalFovDegrees = degrees;
		this.fit();
	}

	/** The narrowest the horizontal field of view may get, in degrees. 0 turns it off. */
	public get minHorizontalFov(): number {
		return this.minHorizontalFovDegrees;
	}

	public set minHorizontalFov(degrees: number) {
		this.minHorizontalFovDegrees = degrees;
		this.fit();
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

	/** Zoom by how much wider or narrower two fingers got: 2 is twice as close, 0.5 twice as far. */
	public pinchBy(ratio: number): this {
		if (!this.zooming || ratio <= 0) {
			return this;
		}

		return this.zoomBy(-Math.log(ratio));
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

	/** @param deltaTime Seconds since the last frame, which is how far `turn` and `tilt` turn it. */
	public update(deltaTime: number = 0): this {
		const seconds = Math.min(deltaTime, MAX_FRAME);
		const target = this.target;

		if (target === undefined) {
			return this;
		}

		if (this.turn !== 0 || this.tilt !== 0) {
			this.rotate(-this.turn * this.turnSpeed * seconds, -this.tilt * this.tiltSpeed * seconds);
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

	/** A drag of so many pixels, wherever it came from: it swings the camera around its target. */
	protected drag(x: number, y: number): void {
		if (!this.dragging) {
			return;
		}

		this.rotate(-x * this.rotateSpeed, y * this.rotateSpeed);
	}

	/** A wheel notch, or anything else that zooms by a distance rather than by a ratio. */
	protected zoomByDelta(delta: number): void {
		if (!this.zooming) {
			return;
		}

		this.zoomBy(delta * this.zoomSpeed);
	}
}
