import { PerspectiveCamera } from "three";
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
}>;

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

	private element?: HTMLElement | Window;
	private pointer = -1;

	private readonly onPointerDown = (event: PointerEvent): void => {
		if (this.dragging && event.button === this.button) {
			this.pointer = event.pointerId;
		}
	};

	private readonly onPointerMove = (event: PointerEvent): void => {
		if (!this.dragging || event.pointerId !== this.pointer) {
			return;
		}

		this.rotate(-event.movementX * this.rotateSpeed, event.movementY * this.rotateSpeed);
	};

	private readonly onPointerUp = (event: PointerEvent): void => {
		if (event.pointerId === this.pointer) {
			this.pointer = -1;
		}
	};

	private readonly onWheel = (event: WheelEvent): void => {
		if (this.zooming) {
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
		this.rotateSpeed = options.rotateSpeed ?? 0.005;
		this.zoomSpeed = options.zoomSpeed ?? 0.001;
		this.dragging = options.dragging ?? true;
		this.zooming = options.zooming ?? true;
		this.button = options.button ?? 0;
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
		this.pointer = -1;

		return this;
	}

	public update(): this {
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
}
