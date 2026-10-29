import { PerspectiveCamera, type Vector3Like } from "three";

export type ControlledCameraOptions = Partial<{
	/** The vertical field of view the game is designed for, in degrees. */
	readonly fov: number;
	/**
	 * The narrowest the horizontal field of view may get, in degrees: on a screen narrower than that
	 * allows, as a phone held upright, the view widens rather than cutting the sides off. 0 turns it off.
	 */
	readonly minHorizontalFov: number;
	readonly near: number;
	readonly far: number;
	/** Radians turned per pixel dragged. */
	readonly rotateSpeed: number;
	/** How fast `turn` at 1 goes round, in radians per second. */
	readonly turnSpeed: number;
	/** How fast `tilt` at 1 tilts, in radians per second. */
	readonly tiltSpeed: number;
	readonly zoomSpeed: number;
}>;

/** Longest step a single frame may move a camera, in seconds: a tab coming back from the background should not swing round. */
const MAX_FRAME = 0.1;

/**
 * A camera the renderer can draw from: it hands it the canvas's input (`connect`), fits it to the
 * canvas on resize (`fit`) and moves it every frame (`update`). `OrbitCamera` turns around a target;
 * the editor's `EditorCamera` flies free.
 */
export abstract class ControlledCamera extends PerspectiveCamera {
	/** Turns the camera every frame: -1 to the left, 1 to the right, 0 still. Set from keys, a stick, anything; the camera reads no input itself. */
	public turn = 0;
	/** Tilts the camera every frame: 1 looks up, -1 looks down, 0 still. */
	public tilt = 0;

	public rotateSpeed: number;
	public turnSpeed: number;
	public tiltSpeed: number;
	public zoomSpeed: number;

	/** What it listens on, and what it lets go of on `destroy`. */
	protected element?: HTMLElement | Window;

	private verticalFovDegrees: number;
	private minHorizontalFovDegrees: number;

	public constructor(options: ControlledCameraOptions = {}) {
		super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);

		this.verticalFovDegrees = this.fov;
		this.minHorizontalFovDegrees = options.minHorizontalFov ?? 60;
		this.rotateSpeed = options.rotateSpeed ?? 0.0025;
		this.turnSpeed = options.turnSpeed ?? 2.5;
		this.tiltSpeed = options.tiltSpeed ?? 1.5;
		this.zoomSpeed = options.zoomSpeed ?? 0.001;
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

		return this;
	}

	/** @param deltaTime Seconds since the last frame, which is how far it turns, moves and swings. */
	public update(deltaTime: number = 0): this {
		this.step(Math.min(deltaTime, MAX_FRAME));

		return this;
	}

	/** Orbit by so many radians: around the target for a camera that has one, around the point it turns about otherwise. Positive pitch looks further down. Stops a `lookFrom` swing. */
	public abstract orbit(yaw: number, pitch: number): this;

	/** Swing round, over so many seconds, to look at the scene from that side: `(0, 1, 0)` from above. 0 seconds is at once. */
	public abstract lookFrom(direction: Vector3Like, seconds?: number): this;

	/** One frame of movement, `seconds` already capped. */
	protected abstract step(seconds: number): void;

	/** Start hearing this device's events. */
	protected abstract listen(element: HTMLElement | Window): void;

	/** Stop hearing them, and let go of whatever is held. */
	protected abstract unlisten(element: HTMLElement | Window): void;
}

/** Smoothstep: a swing that starts and ends gently. */
export function ease(progress: number): number {
	return progress * progress * (3 - 2 * progress);
}
