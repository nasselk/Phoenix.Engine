import { OrbitCamera, type OrbitCameraOptions } from "./Camera";

export type DesktopCameraOptions = OrbitCameraOptions &
	Partial<{
		/** Mouse button that turns the camera around its target while held. 1 is the wheel. */
		readonly button: number;
		/** Mouse button that turns a detached camera while held. 2 is the right one. */
		readonly freeButton: number;
		/** Mouse button that slides a detached camera across what it looks at while held. */
		readonly panButton: number;
	}>;

/** A mouse: a held button turns the camera, another slides a detached one, and the wheel zooms. Keys reach it through the game, as `turn`, `tilt` and `fly…`. */
export class DesktopCamera extends OrbitCamera {
	public button: number;
	public freeButton: number;
	public panButton: number;

	private pointer = -1;
	private panPointer = -1;

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (this.dragging && event.button === (this.free ? this.freeButton : this.button)) {
			this.pointer = event.pointerId;
			this.orbiting = true;
		} else if (this.free && event.button === this.panButton) {
			this.panPointer = event.pointerId;
		}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (event.pointerId === this.pointer) {
			this.drag(event.movementX, event.movementY);
		}

		if (event.pointerId === this.panPointer) {
			this.pan(event.movementX, event.movementY);
		}
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerId === this.pointer) {
			this.pointer = -1;
			this.orbiting = false;
		}

		if (event.pointerId === this.panPointer) {
			this.panPointer = -1;
		}
	};

	private readonly onWheel = (event: WheelEvent): void => {
		this.zoomByDelta(event.deltaY);
	};

	public constructor(options: DesktopCameraOptions = {}) {
		super(options);

		this.button = options.button ?? 0;
		this.freeButton = options.freeButton ?? 2;
		this.panButton = options.panButton ?? 0;
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

		this.pointer = this.panPointer = -1;
	}
}
