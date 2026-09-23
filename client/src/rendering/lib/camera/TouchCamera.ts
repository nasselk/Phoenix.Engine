import { OrbitCamera, type OrbitCameraOptions } from "./Camera";

export type TouchCameraOptions = OrbitCameraOptions &
	Partial<{
		/** How much of a pinch counts: 1 zooms exactly as far as the fingers moved apart. */
		readonly pinchSpeed: number;
	}>;

/** Where a finger was last seen, which is what a drag is measured against. */
type Touch = { x: number; y: number };

/**
 * Fingers: one drags the camera around, two pinch it closer or further away.
 *
 * Touch pointers carry no `movementX`, so each finger's last position is kept and the drag worked out
 * from it. While two are down nothing rotates, or a pinch would swing the camera as the fingers settle.
 */
export class TouchCamera extends OrbitCamera {
	public pinchSpeed: number;

	private readonly touches = new Map<number, Touch>();

	/** How far apart the fingers were last time, so a pinch is a ratio rather than a distance. */
	private spread = 0;

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (event.pointerType === "mouse" || this.touches.size >= 2) {
			return;
		}

		this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
		this.orbiting = true;
		this.spread = this.apart();

		try {
			// Keeps the moves coming when a finger slides off the canvas. A pointer already gone refuses it.
			(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		} catch {}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		const touch = this.touches.get(event.pointerId);

		if (touch === undefined) {
			return;
		}

		const x = event.clientX - touch.x;
		const y = event.clientY - touch.y;

		touch.x = event.clientX;
		touch.y = event.clientY;

		if (this.touches.size === 1) {
			this.drag(x, y);

			return;
		}

		const spread = this.apart();

		if (this.spread > 0 && spread > 0) {
			this.pinchBy((spread / this.spread) ** this.pinchSpeed);
		}

		this.spread = spread;
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (!this.touches.delete(event.pointerId)) {
			return;
		}

		// The finger left on its own carries on from where it is, rather than from where the pinch was.
		this.spread = this.apart();
		this.orbiting = this.touches.size > 0;
	};

	public constructor(options: TouchCameraOptions = {}) {
		super({ rotateSpeed: 0.005, ...options });

		this.pinchSpeed = options.pinchSpeed ?? 1;
	}

	protected override listen(element: HTMLElement | Window): void {
		element.addEventListener("pointerdown", this.onPointerDown as EventListener);
		element.addEventListener("pointermove", this.onPointerMove as EventListener);
		element.addEventListener("pointerup", this.onPointerUp as EventListener);
		element.addEventListener("pointercancel", this.onPointerUp as EventListener);
	}

	protected override unlisten(element: HTMLElement | Window): void {
		element.removeEventListener("pointerdown", this.onPointerDown as EventListener);
		element.removeEventListener("pointermove", this.onPointerMove as EventListener);
		element.removeEventListener("pointerup", this.onPointerUp as EventListener);
		element.removeEventListener("pointercancel", this.onPointerUp as EventListener);

		this.touches.clear();
		this.spread = 0;
	}

	/** The distance between two fingers, and 0 whenever there are not exactly two. */
	private apart(): number {
		if (this.touches.size !== 2) {
			return 0;
		}

		const [first, second] = [...this.touches.values()] as [Touch, Touch];

		return Math.hypot(second.x - first.x, second.y - first.y);
	}
}
