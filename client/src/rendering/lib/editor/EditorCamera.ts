import { Matrix4, type PerspectiveCamera, Quaternion, Vector3, type Vector3Like } from "three";
import { clamp } from "../../../../../shared/math/utils";
import { ControlledCamera, type ControlledCameraOptions, ease } from "../camera/ControlledCamera";

export type EditorCameraOptions = ControlledCameraOptions &
	Partial<{
		/** Units per second it flies at. */
		readonly flySpeed: number;
		/** How many times faster it flies while `flyBoost` is set. */
		readonly boost: number;
		/** Units it slides per pixel dragged while panning. */
		readonly panSpeed: number;
		readonly minZoom: number;
		readonly maxZoom: number;
		/** How far ahead of it is the point `orbit` and `lookFrom` turn it around. */
		readonly distance: number;
		/** Mouse button that turns it while held. 2 is the right one. */
		readonly turnButton: number;
		/** Mouse button that slides it across what it looks at while held. */
		readonly panButton: number;
	}>;

const WORLD_UP = new Vector3(0, 1, 0);
const ORIGIN = new Vector3();
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const STEP = new Vector3();
const SIDE = new Vector3();
const LOOK = new Matrix4();
const TURN = new Quaternion();

/**
 * The editor's own camera, which flies free while the game's camera stays where it is: keys fly and
 * turn it (`flyForward`, `flyRight`, `turn`, `tilt`), one held mouse button turns it, another slides it,
 * and the wheel zooms its lens. Drawn once it is the renderer's `activeCamera`.
 */
export class EditorCamera extends ControlledCamera {
	/** Flies it every frame along where it looks: 1 forward, -1 back. */
	public flyForward = 0;
	/** Flies it every frame sideways: 1 right, -1 left. */
	public flyRight = 0;
	/** Flies `boost` times faster while set. */
	public flyBoost = false;

	public flySpeed: number;
	public boost: number;
	public panSpeed: number;
	public minZoom: number;
	public maxZoom: number;
	public distance: number;
	public turnButton: number;
	public panButton: number;

	private turnPointer = -1;
	private panPointer = -1;

	/** A `lookFrom` swing in progress: the point it turns around, from which facing to which, over how long, and how far along. */
	private readonly swing = { duration: 0, elapsed: 0, pivot: new Vector3(), from: new Quaternion(), to: new Quaternion() };

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
		super(options);

		this.flySpeed = options.flySpeed ?? 20;
		this.boost = options.boost ?? 4;
		this.panSpeed = options.panSpeed ?? 0.03;
		this.minZoom = options.minZoom ?? 0.5;
		this.maxZoom = options.maxZoom ?? 10;
		this.distance = options.distance ?? 14;
		this.turnButton = options.turnButton ?? 2;
		this.panButton = options.panButton ?? 0;
	}

	/** Start from what that camera shows: its place, its facing and its lens, with no zoom and no swing. */
	public startFrom(camera: PerspectiveCamera): this {
		this.position.copy(camera.position);
		this.quaternion.copy(camera.quaternion);
		this.near = camera.near;
		this.far = camera.far;
		this.zoom = 1;
		this.swing.duration = 0;

		if (camera instanceof ControlledCamera) {
			this.minHorizontalFov = camera.minHorizontalFov;
			this.verticalFov = camera.verticalFov;
		} else {
			this.verticalFov = camera.fov;
		}

		return this.fit(camera.aspect);
	}

	/** Lens zoom, clamped to minZoom..maxZoom. Takes effect immediately. */
	public setZoom(zoom: number): this {
		this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
		this.updateProjectionMatrix();

		return this;
	}

	/** Orbit around the point `distance` ahead of it. */
	public override orbit(yaw: number, pitch: number): this {
		this.swing.duration = 0;

		this.ahead(SIDE);
		this.quaternion.premultiply(TURN.setFromAxisAngle(WORLD_UP, yaw));
		this.rotateX(-pitch);
		this.around(SIDE);

		return this;
	}

	/** Swing around the point `distance` ahead of it to look from that side. */
	public override lookFrom(direction: Vector3Like, seconds: number = 0): this {
		const { swing } = this;
		const side = SIDE.copy(direction).normalize();

		this.ahead(swing.pivot);
		swing.from.copy(this.quaternion);

		// Straight down or up, "up" on screen is a horizontal axis, or the view would have no up at all.
		const vertical = side.x === 0 && side.z === 0;

		swing.to.setFromRotationMatrix(LOOK.lookAt(side, ORIGIN, vertical ? STEP.set(0, 0, side.y > 0 ? -1 : 1) : WORLD_UP));
		swing.elapsed = 0;
		swing.duration = seconds;

		if (seconds <= 0) {
			this.quaternion.copy(swing.to);
			this.around(swing.pivot);
		}

		return this;
	}

	protected override step(seconds: number): void {
		const { swing } = this;

		if (swing.duration > 0) {
			swing.elapsed = Math.min(swing.elapsed + seconds, swing.duration);

			this.quaternion.slerpQuaternions(swing.from, swing.to, ease(swing.elapsed / swing.duration));
			this.around(swing.pivot);

			if (swing.elapsed === swing.duration) {
				swing.duration = 0;
			}
		}

		if (this.turn !== 0 || this.tilt !== 0) {
			this.rotateOnWorldAxis(WORLD_UP, -this.turn * this.turnSpeed * seconds);
			this.rotateX(this.tilt * this.tiltSpeed * seconds);
		}

		const along = this.flyForward;
		const across = this.flyRight;

		if (along === 0 && across === 0) {
			return;
		}

		// Forward includes pitch, so looking up and flying forward climbs.
		this.getWorldDirection(FORWARD);
		RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
		STEP.set(0, 0, 0).addScaledVector(FORWARD, along).addScaledVector(RIGHT, across);

		if (STEP.lengthSq() > 1) {
			STEP.normalize();
		}

		this.position.addScaledVector(STEP, this.flySpeed * (this.flyBoost ? this.boost : 1) * seconds);
	}

	protected override listen(element: HTMLElement | Window): void {
		element.addEventListener("pointerdown", this.onPointerDown as EventListener);
		element.addEventListener("wheel", this.onWheel as EventListener, { passive: true });
		window.addEventListener("pointermove", this.onPointerMove);
		window.addEventListener("pointerup", this.onPointerUp);
		window.addEventListener("pointercancel", this.onPointerUp);
	}

	protected override unlisten(element: HTMLElement | Window): void {
		element.removeEventListener("pointerdown", this.onPointerDown as EventListener);
		element.removeEventListener("wheel", this.onWheel as EventListener);
		window.removeEventListener("pointermove", this.onPointerMove);
		window.removeEventListener("pointerup", this.onPointerUp);
		window.removeEventListener("pointercancel", this.onPointerUp);

		this.turnPointer = this.panPointer = -1;
	}

	/** The point `distance` ahead of it, written into `target`. */
	private ahead(target: Vector3): Vector3 {
		return this.getWorldDirection(target).multiplyScalar(this.distance).add(this.position);
	}

	/** Put it `distance` behind that point, along the way it now faces. */
	private around(pivot: Vector3): void {
		this.position.copy(pivot).addScaledVector(STEP.set(0, 0, 1).applyQuaternion(this.quaternion), this.distance);
	}

	/**
	 * A drag of so many pixels turns it, divided by the lens zoom so the picture moves with the mouse.
	 * No clamp and no lock: looking past straight up just carries on over.
	 */
	private drag(x: number, y: number): void {
		const speed = this.rotateSpeed / this.zoom;

		this.swing.duration = 0;
		this.rotateOnWorldAxis(WORLD_UP, -x * speed);
		this.rotateX(-y * speed);
	}

	/** A drag of so many pixels slides it across what it looks at, the picture following the mouse, without turning. */
	private pan(x: number, y: number): void {
		const speed = this.panSpeed / this.zoom;

		this.swing.duration = 0;
		RIGHT.set(1, 0, 0).applyQuaternion(this.quaternion);
		STEP.set(0, 1, 0).applyQuaternion(this.quaternion);

		this.position.addScaledVector(RIGHT, -x * speed).addScaledVector(STEP, y * speed);
	}
}
