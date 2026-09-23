import { Vector3 } from "three";
import { OrbitCamera, type OrbitCameraOptions } from "./Camera";

/** Physical key codes, so this is ZQSD on AZERTY and WASD on QWERTY without either being special-cased. */
export type FlyKeys = {
	readonly forward: readonly string[];
	readonly back: readonly string[];
	readonly left: readonly string[];
	readonly right: readonly string[];
	readonly boost: readonly string[];
};

export type DesktopCameraOptions = OrbitCameraOptions &
	Partial<{
		/** Mouse button that turns the camera while held. 1 is the wheel. */
		readonly button: number;
		readonly flySpeed: number;
		readonly boost: number;
		readonly keys: Partial<FlyKeys>;
	}>;

/** A mouse and a keyboard: a held button turns the camera, the wheel zooms, and detached it flies on keys. */
export class DesktopCamera extends OrbitCamera {
	public button: number;

	public flySpeed: number;
	public boost: number;

	public readonly keys: FlyKeys;

	private pointer = -1;

	private readonly held = new Set<string>();

	private readonly forward = new Vector3();
	private readonly right = new Vector3();
	private readonly step = new Vector3();

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (this.dragging && event.button === this.button) {
			this.pointer = event.pointerId;
			this.orbiting = true;
		}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (event.pointerId === this.pointer) {
			this.drag(event.movementX, event.movementY);
		}
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerId === this.pointer) {
			this.pointer = -1;
			this.orbiting = false;
		}
	};

	private readonly onWheel = (event: WheelEvent): void => {
		this.zoomByDelta(event.deltaY);
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

	public constructor(options: DesktopCameraOptions = {}) {
		super(options);

		this.button = options.button ?? 0;
		this.flySpeed = options.flySpeed ?? 20;
		this.boost = options.boost ?? 4;
		this.keys = {
			forward: options.keys?.forward ?? ["KeyW", "ArrowUp"],
			back: options.keys?.back ?? ["KeyS", "ArrowDown"],
			left: options.keys?.left ?? ["KeyA", "ArrowLeft"],
			right: options.keys?.right ?? ["KeyD", "ArrowRight"],
			boost: options.keys?.boost ?? ["ShiftLeft", "ShiftRight"],
		};
	}

	protected override listen(element: HTMLElement | Window): void {
		element.addEventListener("pointerdown", this.onPointerDown as EventListener);
		element.addEventListener("wheel", this.onWheel as EventListener, { passive: true });
		// On the window rather than the element: a drag that leaves the canvas still turns the camera.
		window.addEventListener("pointermove", this.onPointerMove);
		window.addEventListener("pointerup", this.onPointerUp);
		window.addEventListener("pointercancel", this.onPointerUp);
		window.addEventListener("keydown", this.onKeyDown);
		window.addEventListener("keyup", this.onKeyUp);
		window.addEventListener("blur", this.onBlur);
	}

	protected override unlisten(element: HTMLElement | Window): void {
		element.removeEventListener("pointerdown", this.onPointerDown as EventListener);
		element.removeEventListener("wheel", this.onWheel as EventListener);
		window.removeEventListener("pointermove", this.onPointerMove);
		window.removeEventListener("pointerup", this.onPointerUp);
		window.removeEventListener("pointercancel", this.onPointerUp);
		window.removeEventListener("keydown", this.onKeyDown);
		window.removeEventListener("keyup", this.onKeyUp);
		window.removeEventListener("blur", this.onBlur);

		this.pointer = -1;
		this.held.clear();
	}

	protected override onDetached(_detached: boolean): void {
		this.held.clear();
	}

	/** Move along where the camera looks — forward includes pitch, so looking up and pressing forward climbs. */
	protected override fly(seconds: number): void {
		const { forward, right, step, keys } = this;
		const along = this.pressed(keys.forward) - this.pressed(keys.back);
		const across = this.pressed(keys.right) - this.pressed(keys.left);

		if (along === 0 && across === 0) {
			return;
		}

		// The camera's own axes in the world: it looks down its -Z, and its +X is its right.
		this.getWorldDirection(forward);
		right.set(1, 0, 0).applyQuaternion(this.quaternion);

		step.set(0, 0, 0).addScaledVector(forward, along).addScaledVector(right, across).normalize();

		this.position.addScaledVector(step, this.flySpeed * (this.pressed(keys.boost) ? this.boost : 1) * seconds);
	}

	private pressed(codes: readonly string[]): number {
		for (const code of codes) {
			if (this.held.has(code)) {
				return 1;
			}
		}

		return 0;
	}
}
