import { OrbitCamera, type OrbitCameraOptions } from "./Camera";

export type DesktopCameraOptions = OrbitCameraOptions &
	Partial<{
		/** Mouse button that turns the camera while held. 1 is the wheel. */
		readonly button: number;
	}>;

/** A mouse: a held button turns the camera and the wheel zooms. Keys reach it through the game, as `turn`, `tilt` and `fly…`. */
export class DesktopCamera extends OrbitCamera {
	public button: number;

	private pointer = -1;

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

	public constructor(options: DesktopCameraOptions = {}) {
		super(options);

		this.button = options.button ?? 0;
	}

	protected override listen(element: HTMLElement | Window): void {
		element.addEventListener("pointerdown", this.onPointerDown as EventListener);
		element.addEventListener("wheel", this.onWheel as EventListener, { passive: true });
		// On the window rather than the element: a drag that leaves the canvas still turns the camera.
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

		this.pointer = -1;
	}
}
