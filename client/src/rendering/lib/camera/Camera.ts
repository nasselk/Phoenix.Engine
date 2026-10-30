import { PerspectiveCamera, Vector3, type Vector3Like } from "three";
import { normalizeAnglePI } from "../../../../../shared/math/angle";
import { clamp } from "../../../../../shared/math/utils";

export type CameraTarget = { readonly x: number; readonly y: number; readonly z: number };

export type CameraOptions = Partial<{
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
	/** Radians above the anchor: positive looks down on it, `Math.PI / 2` straight down. */
	readonly pitch: number;
	readonly distance: number;
	readonly minPitch: number;
	readonly maxPitch: number;
	readonly minDistance: number;
	readonly maxDistance: number;
	/** What a drag, `turn` and `tilt` turn it around: its anchor, or its own eye, looking around in place. With a target, always the anchor. */
	readonly turnsAbout: "anchor" | "eye";
	/** What the wheel and a pinch change: how far it is from its anchor, or its lens. */
	readonly zoomMode: "distance" | "lens";
	readonly minZoom: number;
	readonly maxZoom: number;
	/** Radians turned per pixel a mouse drags. */
	readonly rotateSpeed: number;
	/** How much faster a finger dragging turns it than a mouse dragging as far. */
	readonly touchRotateScale: number;
	/** How fast `turn` at 1 goes round, in radians per second. */
	readonly turnSpeed: number;
	/** How fast `tilt` at 1 tilts, in radians per second. */
	readonly tiltSpeed: number;
	readonly zoomSpeed: number;
	/** How much of a pinch counts: 1 zooms exactly as far as the fingers moved apart. */
	readonly pinchSpeed: number;
	/** Units it slides per pixel dragged while panning. */
	readonly panSpeed: number;
	/** Units per second it flies at. */
	readonly flySpeed: number;
	/** How many times faster it flies while `flyBoost` is set. */
	readonly boost: number;
	/** Whether a drag turns it. */
	readonly dragging: boolean;
	/** Whether the wheel and a pinch zoom it. */
	readonly zooming: boolean;
	/** Whether `panButton`, or two fingers, slide it. */
	readonly panning: boolean;
	/** Mouse button that turns it while held. 0 is the left one, 2 the right one. */
	readonly turnButton: number;
	/** Mouse button that slides it while held, when `panning`. */
	readonly panButton: number;
}>;

/** Where a finger was last seen, which is what a drag is measured against. */
type Touch = { x: number; y: number };

/** Longest step a single frame may move a camera, in seconds: a tab coming back from the background should not swing round. */
const MAX_FRAME = 0.1;

const OFFSET = new Vector3();
const EYE = new Vector3();
const FORWARD = new Vector3();
const RIGHT = new Vector3();
const UP = new Vector3();
const STEP = new Vector3();

/**
 * The one camera: it turns around an anchor, from a yaw, a pitch and a distance. With a `target` the
 * anchor follows it, as the game's camera follows the player; without one the anchor is its own, and
 * flying and panning move it, as the editor's does. A mouse and fingers both drive it: a held button
 * or one finger turns it, the wheel or a pinch zooms it, another button or two fingers slide it.
 *
 * It reads no keys: a game sets `turn`, `tilt`, `flyForward`, `flyRight` and `flyBoost` from its actions.
 */
export class Camera extends PerspectiveCamera {
	/** What the anchor follows: assign an entity's position. Read, never written. */
	public target?: CameraTarget;
	/** The point it turns around, which is the camera's own: it copies `target` every frame, and flying and panning move it without one. */
	public readonly anchor = new Vector3();

	public yaw: number;
	public pitch: number;
	public distance: number;

	public minPitch: number;
	public maxPitch: number;
	public minDistance: number;
	public maxDistance: number;

	public turnsAbout: "anchor" | "eye";
	public zoomMode: "distance" | "lens";
	public minZoom: number;
	public maxZoom: number;

	/** Turns the camera every frame: -1 to the left, 1 to the right, 0 still. Set from keys, a stick, anything. */
	public turn = 0;
	/** Tilts the camera every frame: 1 looks up, -1 looks down, 0 still. */
	public tilt = 0;
	/** Flies the anchor every frame along where it looks: 1 forward, -1 back. Only without a target. */
	public flyForward = 0;
	/** Flies the anchor every frame sideways: 1 right, -1 left. Only without a target. */
	public flyRight = 0;
	/** Flies `boost` times faster while set. */
	public flyBoost = false;

	public rotateSpeed: number;
	public touchRotateScale: number;
	public turnSpeed: number;
	public tiltSpeed: number;
	public zoomSpeed: number;
	public pinchSpeed: number;
	public panSpeed: number;
	public flySpeed: number;
	public boost: number;

	public dragging: boolean;
	public zooming: boolean;
	public panning: boolean;
	public turnButton: number;
	public panButton: number;

	/** What it listens on, and what it lets go of on `destroy`. */
	private element?: HTMLElement | Window;

	private verticalFovDegrees: number;
	private minHorizontalFovDegrees: number;

	private turnPointer = -1;
	private panPointer = -1;
	private readonly touches = new Map<number, Touch>();
	/** How far apart two fingers were last time, so a pinch is a ratio rather than a distance. */
	private spread = 0;
	/** Where the middle of two fingers was last time, which a two-finger slide is measured against. */
	private readonly middle = { x: 0, y: 0 };

	/** A `lookFrom` swing in progress: from which yaw and pitch to which, over how long, and how far along. */
	private readonly swing = { duration: 0, elapsed: 0, fromYaw: 0, toYaw: 0, fromPitch: 0, toPitch: 0 };

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (event.pointerType === "mouse") {
			if (this.dragging && event.button === this.turnButton) {
				this.turnPointer = event.pointerId;
			} else if (this.panning && event.button === this.panButton) {
				this.panPointer = event.pointerId;
			}

			return;
		}

		if (this.touches.size >= 2) {
			return;
		}

		this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
		this.measureFingers();

		try {
			// Keeps the moves coming when a finger slides off the canvas. A pointer already gone refuses it.
			(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		} catch {}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (event.pointerId === this.turnPointer) {
			this.drag(event.movementX, event.movementY);
		}

		if (event.pointerId === this.panPointer) {
			this.pan(event.movementX, event.movementY);
		}

		const touch = this.touches.get(event.pointerId);

		if (touch === undefined) {
			return;
		}

		const x = event.clientX - touch.x;
		const y = event.clientY - touch.y;

		touch.x = event.clientX;
		touch.y = event.clientY;

		if (this.touches.size === 1) {
			this.drag(x * this.touchRotateScale, y * this.touchRotateScale);

			return;
		}

		const spread = this.apart();

		if (this.spread > 0 && spread > 0) {
			this.pinchBy((spread / this.spread) ** this.pinchSpeed);
		}

		this.spread = spread;

		const { middle } = this;
		const fromX = middle.x;
		const fromY = middle.y;

		this.center();
		this.pan(middle.x - fromX, middle.y - fromY);
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerId === this.turnPointer) {
			this.turnPointer = -1;
		}

		if (event.pointerId === this.panPointer) {
			this.panPointer = -1;
		}

		// The finger left on its own carries on from where it is, rather than from where the pinch was.
		if (this.touches.delete(event.pointerId)) {
			this.measureFingers();
		}
	};

	private readonly onWheel = (event: WheelEvent): void => {
		if (this.zooming) {
			this.zoomBy(event.deltaY * this.zoomSpeed);
		}
	};

	public constructor(options: CameraOptions = {}) {
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
		this.turnsAbout = options.turnsAbout ?? "anchor";
		this.zoomMode = options.zoomMode ?? "distance";
		this.minZoom = options.minZoom ?? 0.5;
		this.maxZoom = options.maxZoom ?? 10;

		this.rotateSpeed = options.rotateSpeed ?? 0.0025;
		this.touchRotateScale = options.touchRotateScale ?? 2;
		this.turnSpeed = options.turnSpeed ?? 2.5;
		this.tiltSpeed = options.tiltSpeed ?? 1.5;
		this.zoomSpeed = options.zoomSpeed ?? 0.001;
		this.pinchSpeed = options.pinchSpeed ?? 1;
		this.panSpeed = options.panSpeed ?? 0.03;
		this.flySpeed = options.flySpeed ?? 20;
		this.boost = options.boost ?? 4;

		this.dragging = options.dragging ?? true;
		this.zooming = options.zooming ?? true;
		this.panning = options.panning ?? false;
		this.turnButton = options.turnButton ?? 0;
		this.panButton = options.panButton ?? 2;

		this.place();
	}

	/** Whether a held button or a finger is turning it right now. */
	public get isOrbiting(): boolean {
		return this.turnPointer !== -1 || this.touches.size > 0;
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

	/** Turn around the anchor by so many radians, within its pitch limits. Positive pitch looks further down. */
	public rotate(yaw: number, pitch: number): this {
		this.yaw += yaw;
		this.pitch = clamp(this.pitch + pitch, this.minPitch, this.maxPitch);

		return this.place();
	}

	/** `rotate`, and stop a `lookFrom` swing. */
	public orbit(yaw: number, pitch: number): this {
		this.swing.duration = 0;

		return this.rotate(yaw, pitch);
	}

	/** Swing round its anchor, over so many seconds, to look from that side, the shortest way round, within its pitch limits: `(0, 1, 0)` from above. 0 seconds is at once. */
	public lookFrom(direction: Vector3Like, seconds: number = 0): this {
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

		return this.place();
	}

	/** Zoom by `exp(amount)`: further from the anchor, or a wider lens. Negative comes closer. */
	public zoomBy(amount: number): this {
		if (this.zoomMode === "lens") {
			return this.setZoom(this.zoom * Math.exp(-amount));
		}

		this.distance = clamp(this.distance * Math.exp(amount), this.minDistance, this.maxDistance);

		return this.place();
	}

	/** Zoom by how much wider or narrower two fingers got: 2 is twice as close, 0.5 twice as far. */
	public pinchBy(ratio: number): this {
		if (!this.zooming || ratio <= 0) {
			return this;
		}

		return this.zoomBy(-Math.log(ratio));
	}

	/** Lens zoom, within minZoom and maxZoom. */
	public setZoom(zoom: number): this {
		this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
		this.updateProjectionMatrix();

		return this;
	}

	/**
	 * Start from what that camera shows: its place, its facing (within this one's pitch limits) and its
	 * lens, with no lens zoom and no swing. The anchor goes `distance` ahead.
	 */
	public startFrom(camera: PerspectiveCamera): this {
		camera.getWorldDirection(FORWARD);

		if (camera instanceof Camera) {
			this.yaw = camera.yaw;
			this.pitch = clamp(camera.pitch, this.minPitch, this.maxPitch);
			this.minHorizontalFov = camera.minHorizontalFov;
			this.verticalFov = camera.verticalFov;
		} else {
			this.yaw = Math.atan2(-FORWARD.x, -FORWARD.z);
			this.pitch = clamp(Math.asin(clamp(-FORWARD.y, -1, 1)), this.minPitch, this.maxPitch);
			this.verticalFov = camera.fov;
		}

		this.anchor.copy(camera.position).addScaledVector(FORWARD, this.distance);
		this.near = camera.near;
		this.far = camera.far;
		this.zoom = 1;
		this.swing.duration = 0;

		this.fit(camera.aspect);

		return this.place();
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
		this.touches.clear();
		this.spread = 0;

		return this;
	}

	/** @param deltaTime Seconds since the last frame, which is how far it turns, flies and swings. */
	public update(deltaTime: number = 0): this {
		const seconds = Math.min(deltaTime, MAX_FRAME);
		const { swing, target } = this;

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

		if (target !== undefined) {
			this.anchor.set(target.x, target.y, target.z);
		}

		if (this.turn !== 0 || this.tilt !== 0) {
			this.look(-this.turn * this.turnSpeed * seconds, -this.tilt * this.tiltSpeed * seconds);
		}

		if (target === undefined && (this.flyForward !== 0 || this.flyRight !== 0)) {
			this.facing(FORWARD);
			this.screenRight(RIGHT);
			STEP.set(0, 0, 0).addScaledVector(FORWARD, this.flyForward).addScaledVector(RIGHT, this.flyRight);

			if (STEP.lengthSq() > 1) {
				STEP.normalize();
			}

			this.anchor.addScaledVector(STEP, this.flySpeed * (this.flyBoost ? this.boost : 1) * seconds);
		}

		return this.place();
	}

	/** Turn by so many radians around what `turnsAbout` names: the anchor, or its own eye, which then stays put while the anchor swings round it. */
	private look(yaw: number, pitch: number): void {
		if (this.turnsAbout === "anchor" || this.target !== undefined) {
			this.rotate(yaw, pitch);

			return;
		}

		EYE.copy(this.anchor).add(this.offset(OFFSET));
		this.rotate(yaw, pitch);
		this.anchor.copy(EYE).sub(this.offset(OFFSET));
		this.place();
	}

	/** A drag of so many pixels turns it, divided by the lens zoom so the picture moves with the pointer. Stops a swing. */
	private drag(x: number, y: number): void {
		if (!this.dragging) {
			return;
		}

		const speed = this.rotateSpeed / this.zoom;

		this.swing.duration = 0;
		this.look(-x * speed, y * speed);
	}

	/** A drag of so many pixels slides the anchor across the view, the picture following the pointer, without turning. Not while following a target. */
	private pan(x: number, y: number): void {
		if (!this.panning || this.target !== undefined) {
			return;
		}

		const speed = this.panSpeed / this.zoom;

		this.swing.duration = 0;
		this.anchor.addScaledVector(this.screenRight(RIGHT), -x * speed).addScaledVector(this.screenUp(UP), y * speed);
		this.place();
	}

	/** Put it `distance` from its anchor along its yaw and pitch, looking at the anchor. */
	private place(): this {
		this.position.copy(this.anchor).add(this.offset(OFFSET));
		this.rotation.set(-this.pitch, this.yaw, 0, "YXZ");

		return this;
	}

	/** From the anchor to the camera, `distance` long. */
	private offset(out: Vector3): Vector3 {
		const flat = Math.cos(this.pitch) * this.distance;

		return out.set(Math.sin(this.yaw) * flat, Math.sin(this.pitch) * this.distance, Math.cos(this.yaw) * flat);
	}

	/** Where it looks, pitch included, so flying forward while looking up climbs. */
	private facing(out: Vector3): Vector3 {
		const flat = Math.cos(this.pitch);

		return out.set(-Math.sin(this.yaw) * flat, -Math.sin(this.pitch), -Math.cos(this.yaw) * flat);
	}

	private screenRight(out: Vector3): Vector3 {
		return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
	}

	/** Up on screen. */
	private screenUp(out: Vector3): Vector3 {
		const lift = Math.sin(this.pitch);

		return out.set(-Math.sin(this.yaw) * lift, Math.cos(this.pitch), -Math.cos(this.yaw) * lift);
	}

	/** After a finger goes down or up: the spread and middle a pinch and a slide are measured from. */
	private measureFingers(): void {
		this.spread = this.apart();
		this.center();
	}

	/** The distance between two fingers, and 0 whenever there are not exactly two. */
	private apart(): number {
		if (this.touches.size !== 2) {
			return 0;
		}

		const [first, second] = [...this.touches.values()] as [Touch, Touch];

		return Math.hypot(second.x - first.x, second.y - first.y);
	}

	private center(): void {
		const { middle } = this;

		middle.x = middle.y = 0;

		for (const touch of this.touches.values()) {
			middle.x += touch.x / this.touches.size;
			middle.y += touch.y / this.touches.size;
		}
	}
}

/** Smoothstep: a swing that starts and ends gently. */
export function ease(progress: number): number {
	return progress * progress * (3 - 2 * progress);
}
