import { PerspectiveCamera, Vector3 } from "three";
import { clamp } from "../../../../../shared/math/utils";

export type EditorCameraOptions = Partial<{
	readonly fov: number;
	readonly near: number;
	readonly far: number;
	/** Radians turned per pixel dragged. */
	readonly rotateSpeed: number;
	/** How fast `turn` at 1 goes round, in radians per second. */
	readonly turnSpeed: number;
	/** How fast `tilt` at 1 tilts, in radians per second. */
	readonly tiltSpeed: number;
	/** Units per second it flies at. */
	readonly flySpeed: number;
	/** How many times faster it flies while `flyBoost` is set. */
	readonly boost: number;
	/** Units it slides per pixel dragged while panning. */
	readonly panSpeed: number;
	readonly zoomSpeed: number;
	readonly minZoom: number;
	readonly maxZoom: number;
	/** How far ahead of it is the point the navigation gizmo turns it around. */
	readonly distance: number;
	/** Mouse button that turns it while held. 2 is the right one. */
	readonly turnButton: number;
	/** Mouse button that slides it across what it looks at while held. */
	readonly panButton: number;
}>;

const WORLD_UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const STEP = new Vector3();

/** Longest step a single frame may fly, in seconds: a tab coming back from the background should not teleport. */
const MAX_FRAME = 0.1;

/**
 * The editor's own camera, which flies free while the game's camera stays where it is: keys fly and
 * turn it (`flyForward`, `flyRight`, `turn`, `tilt`), one held mouse button turns it, another slides it,
 * and the wheel zooms its lens. Drawn once it is the renderer's `activeCamera`.
 */
export class EditorCamera extends PerspectiveCamera {
	/** Turns it every frame: -1 to the left, 1 to the right, 0 still. */
	public turn = 0;
	/** Tilts it every frame: 1 looks up, -1 looks down, 0 still. */
	public tilt = 0;
	/** Flies it every frame along where it looks: 1 forward, -1 back. */
	public flyForward = 0;
	/** Flies it every frame sideways: 1 right, -1 left. */
	public flyRight = 0;
	/** Flies `boost` times faster while set. */
	public flyBoost = false;

	public rotateSpeed: number;
	public turnSpeed: number;
	public tiltSpeed: number;
	public flySpeed: number;
	public boost: number;
	public panSpeed: number;
	public zoomSpeed: number;
	public minZoom: number;
	public maxZoom: number;
	public distance: number;
	public turnButton: number;
	public panButton: number;

	private element?: HTMLElement | Window;
	private turnPointer = -1;
	private panPointer = -1;

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (event.button === this.turnButton) {
			this.turnPointer = event.pointerId;
		} else if (event.button === this.panButton) {
			this.panPointer = event.pointerId;
		}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (event.pointerId === this.turnPointer) {
			this.drag(event.movementX, event.movementY);
		}

		if (event.pointerId === this.panPointer) {
			this.pan(event.movementX, event.movementY);
		}
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerId === this.turnPointer) {
			this.turnPointer = -1;
		}

		if (event.pointerId === this.panPointer) {
			this.panPointer = -1;
		}
	};

	private readonly onWheel = (event: WheelEvent): void => {
		this.setZoom(this.zoom * Math.exp(-event.deltaY * this.zoomSpeed));
	};

	public constructor(options: EditorCameraOptions = {}) {
		super(options.fov ?? 75, 1, options.near ?? 0.1, options.far ?? 1000);

		this.rotateSpeed = options.rotateSpeed ?? 0.0025;
		this.turnSpeed = options.turnSpeed ?? 2.5;
		this.tiltSpeed = options.tiltSpeed ?? 1.5;
		this.flySpeed = options.flySpeed ?? 20;
		this.boost = options.boost ?? 4;
		this.panSpeed = options.panSpeed ?? 0.03;
		this.zoomSpeed = options.zoomSpeed ?? 0.001;
		this.minZoom = options.minZoom ?? 0.5;
		this.maxZoom = options.maxZoom ?? 10;
		this.distance = options.distance ?? 14;
		this.turnButton = options.turnButton ?? 2;
		this.panButton = options.panButton ?? 0;
	}

	/** Start from what that camera shows: its place, its facing and its lens, with no zoom. */
	public startFrom(camera: PerspectiveCamera): this {
		this.position.copy(camera.position);
		this.quaternion.copy(camera.quaternion);
		this.fov = camera.fov;
		this.near = camera.near;
		this.far = camera.far;
		this.aspect = camera.aspect;
		this.zoom = 1;
		this.updateProjectionMatrix();

		return this;
	}

	/** Match a canvas of that shape. What the renderer calls on every resize. */
	public fit(aspect: number = this.aspect): this {
		this.aspect = aspect;
		this.updateProjectionMatrix();

		return this;
	}

	/** Lens zoom, clamped to minZoom..maxZoom. Takes effect immediately. */
	public setZoom(zoom: number): this {
		this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
		this.updateProjectionMatrix();

		return this;
	}

	public connect(element: HTMLElement | Window = window): this {
		this.destroy();

		this.element = element;

		element.addEventListener("pointerdown", this.onPointerDown as EventListener);
		element.addEventListener("wheel", this.onWheel as EventListener, { passive: true });
		window.addEventListener("pointermove", this.onPointerMove);
		window.addEventListener("pointerup", this.onPointerUp);
		window.addEventListener("pointercancel", this.onPointerUp);

		return this;
	}

	public destroy(): this {
		const element = this.element;

		if (element === undefined) {
			return this;
		}

		element.removeEventListener("pointerdown", this.onPointerDown as EventListener);
		element.removeEventListener("wheel", this.onWheel as EventListener);
		window.removeEventListener("pointermove", this.onPointerMove);
		window.removeEventListener("pointerup", this.onPointerUp);
		window.removeEventListener("pointercancel", this.onPointerUp);

		this.element = undefined;
		this.turnPointer = this.panPointer = -1;

		return this;
	}

	/** @param deltaTime Seconds since the last frame, which is how far it flies and turns. */
	public update(deltaTime: number = 0): this {
		const seconds = Math.min(deltaTime, MAX_FRAME);

		if (this.turn !== 0 || this.tilt !== 0) {
			this.rotateOnWorldAxis(WORLD_UP, -this.turn * this.turnSpeed * seconds);
			this.rotateX(this.tilt * this.tiltSpeed * seconds);
		}

		const along = this.flyForward;
		const across = this.flyRight;

		if (along === 0 && across === 0) {
			return this;
		}

		// Forward includes pitch, so looking up and flying forward climbs.
		this.getWorldDirection(FORWARD);
		RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
		STEP.set(0, 0, 0).addScaledVector(FORWARD, along).addScaledVector(RIGHT, across);

		if (STEP.lengthSq() > 1) {
			STEP.normalize();
		}

		this.position.addScaledVector(STEP, this.flySpeed * (this.flyBoost ? this.boost : 1) * seconds);

		return this;
	}

	/**
	 * A drag of so many pixels turns it, divided by the lens zoom so the picture moves with the mouse.
	 * No clamp and no lock: looking past straight up just carries on over.
	 */
	private drag(x: number, y: number): void {
		const speed = this.rotateSpeed / this.zoom;

		this.rotateOnWorldAxis(WORLD_UP, -x * speed);
		this.rotateX(-y * speed);
	}

	/** A drag of so many pixels slides it across what it looks at, the picture following the mouse, without turning. */
	private pan(x: number, y: number): void {
		const speed = this.panSpeed / this.zoom;

		RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
		STEP.set(0, 1, 0).applyQuaternion(this.quaternion);

		this.position.addScaledVector(RIGHT, -x * speed).addScaledVector(STEP, y * speed);
	}
}
