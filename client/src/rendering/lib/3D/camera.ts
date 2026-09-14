import { PerspectiveCamera, Vector3 } from "three";
import { clamp } from "../../../../../shared/libs/math/utils";

export type OrbitTarget = { readonly x: number; readonly y: number; readonly z: number };

export type OrbitCameraOptions = Partial<{
	fov: number;
	near: number;
	far: number;
	yaw: number;
	pitch: number;
	distance: number;
	minPitch: number;
	maxPitch: number;
	minDistance: number;
	maxDistance: number;
	rotateSpeed: number;
	zoomSpeed: number;
	dragging: boolean;
	zooming: boolean;
	button: number;
	/** Units per second when detached. */
	flySpeed: number;
	/** Multiplier on flySpeed while Shift is held. */
	boost: number;
	/** Lens zoom limits while detached: below 1 widens the view, above 1 magnifies it. */
	minZoom: number;
	maxZoom: number;
}>;

/** Physical key codes, so this is ZQSD on AZERTY and WASD on QWERTY without either being special-cased. */
const FLY_KEYS = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD" } as const;

const WORLD_UP = new Vector3(0, 1, 0);

/** Longest step a single frame may fly, in seconds: a tab coming back from the background should not teleport. */
const MAX_FRAME = 0.1;

export class OrbitCamera extends PerspectiveCamera {
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
	public button: number;

	public flySpeed: number;
	public boost: number;

	public minZoom: number;
	public maxZoom: number;

	private element?: HTMLElement | Window;
	private pointer = -1;

	private free = false;
	private readonly held = new Set<string>();
	private lastUpdate = 0;

	private readonly forward = new Vector3();
	private readonly right = new Vector3();
	private readonly step = new Vector3();

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (this.dragging && event.button === this.button) {
			this.pointer = event.pointerId;
		}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (!this.dragging || event.pointerId !== this.pointer) {
			return;
		}

		if (this.free) {
			// No clamp and no lock: yaw turns around the world's up, pitch around the camera's own
			// sideways axis, both on the quaternion — so looking past straight up just carries on over.
			// Divided by the lens zoom: zoomed in, the view spans less of the scene, so the same drag
			// has to turn it less for the picture to move the same distance under the cursor.
			const speed = this.rotateSpeed / this.zoom;

			this.rotateOnWorldAxis(WORLD_UP, -event.movementX * speed);
			this.rotateX(-event.movementY * speed);

			return;
		}

		this.rotate(-event.movementX * this.rotateSpeed, event.movementY * this.rotateSpeed);
	};

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		const target = event.target as HTMLElement | null;

		// Typing a name or a room code is not flying.
		if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
			return;
		}

		this.held.add(event.code);
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		this.held.delete(event.code);
	};

	private readonly onBlur = (): void => {
		this.held.clear();
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerId === this.pointer) {
			this.pointer = -1;
		}
	};

	private readonly onWheel = (event: WheelEvent): void => {
		if (!this.zooming) {
			return;
		}

		if (this.free) {
			// Detached there is no target to move closer to, so the wheel zooms the lens instead:
			// straight into the middle of the view, without moving the camera an inch.
			this.setZoom(this.zoom * Math.exp(-event.deltaY * this.zoomSpeed));
		} else {
			this.zoomBy(event.deltaY * this.zoomSpeed);
		}
	};

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
		this.button = options.button ?? 0;
		this.flySpeed = options.flySpeed ?? 20;
		this.boost = options.boost ?? 4;
		this.minZoom = options.minZoom ?? 0.5;
		this.maxZoom = options.maxZoom ?? 10;
	}

	/** Whether the camera flies free instead of orbiting its target. */
	public get detached(): boolean {
		return this.free;
	}

	/**
	 * Detach to fly free from exactly where the camera is, or attach to snap back to orbiting the
	 * target at the yaw, pitch and distance it had before.
	 */
	public setDetached(detached: boolean): this {
		this.free = detached;
		this.held.clear();

		// The lens zoom belongs to free flight: attached, the camera zooms by its distance instead.
		if (!detached && this.zoom !== 1) {
			this.zoom = 1;
			this.updateProjectionMatrix();
		}

		return this;
	}

	/** Lens zoom, clamped to minZoom..maxZoom. Takes effect immediately. */
	public setZoom(zoom: number): this {
		this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
		this.updateProjectionMatrix();

		return this;
	}

	public toggleDetached(): this {
		return this.setDetached(!this.free);
	}

	public get isOrbiting(): boolean {
		return this.pointer !== -1;
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

	public connect(element: HTMLElement | Window = window): this {
		this.destroy();

		this.element = element;

		element.addEventListener("pointerdown", this.onPointerDown as EventListener);
		element.addEventListener("wheel", this.onWheel as EventListener, { passive: true });
		window.addEventListener("pointermove", this.onPointerMove);
		window.addEventListener("pointerup", this.onPointerUp);
		window.addEventListener("pointercancel", this.onPointerUp);
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		window.addEventListener("blur", this.onBlur);

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
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		window.removeEventListener("blur", this.onBlur);

		this.element = undefined;
		this.pointer = -1;
		this.held.clear();

		return this;
	}

	public update(): this {
		const now = performance.now();
		const seconds = this.lastUpdate === 0 ? 0 : Math.min((now - this.lastUpdate) / 1000, MAX_FRAME);

		this.lastUpdate = now;

		if (this.free) {
			return this.fly(seconds);
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

	/** Move along where the camera looks — forward includes pitch, so looking up and pressing forward climbs. */
	private fly(seconds: number): this {
		const { held, forward, right, step } = this;
		const along = (held.has(FLY_KEYS.forward) ? 1 : 0) - (held.has(FLY_KEYS.back) ? 1 : 0);
		const across = (held.has(FLY_KEYS.right) ? 1 : 0) - (held.has(FLY_KEYS.left) ? 1 : 0);

		if (along === 0 && across === 0) {
			return this;
		}

		// The camera's own axes in the world: it looks down its -Z, and its +X is its right.
		this.getWorldDirection(forward);
		right.set(1, 0, 0).applyQuaternion(this.quaternion);

		step.set(0, 0, 0).addScaledVector(forward, along).addScaledVector(right, across).normalize();

		const speed = this.flySpeed * (held.has("ShiftLeft") || held.has("ShiftRight") ? this.boost : 1);

		this.position.addScaledVector(step, speed * seconds);

		return this;
	}
}
