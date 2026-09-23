import { type ColorRepresentation, Scene, WebGLRenderer, type WebGLRendererParameters } from "three";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { log } from "../../../shared/utils/logger";
import { waitForUserGesture } from "../utils/gesture";
import type { OrbitCamera } from "./lib/camera/Camera";
import { DesktopCamera } from "./lib/camera/DesktopCamera";
import { TextureBuilder } from "./lib/TextureBuilder";
import { TouchCamera } from "./lib/camera/TouchCamera";

type RenderSystemEvents = {
	init: [renderer: HTMLCanvasElement];
	render: [deltaTime: number, now: number];
	resize: [width: number, height: number];
	destroy: [];
};

export type RenderSystemOptions = {
	readonly renderer?: "WebGL" | "WebGPU";
	readonly resolution?: number;
	readonly fullscreen?: boolean;
	readonly backgroundColor?: ColorRepresentation;
	readonly three?: Omit<WebGLRendererParameters, "canvas">;
};

export const enum RenderSystemState {
	NULL,
	INITIALIZING,
	INITIALIZED,
	DESTROYED,
}

/** The three.js renderer: the canvas, the WebGL context, the scene and the camera. */
export class RenderSystem extends EventEmitter<RenderSystemEvents> {
	protected canvas!: HTMLCanvasElement;

	private three!: WebGLRenderer;

	/** The 3D scene */
	public readonly scene: Scene;

	/** The 3D camera */
	public camera: OrbitCamera;

	/** The texture builder for creating textures in the 3D scene */
	public readonly textureBuilder: TextureBuilder;

	/** The current state of the rendering system. */
	public initialized: RenderSystemState;

	/** The resolution of the renderer. */
	public resolution: number;

	private observer?: ResizeObserver;

	/**
	 * @param touch Fingers rather than a mouse: the camera then turns on a drag and zooms on a pinch,
	 *   where a desktop one waits for a held button and a wheel. The engine passes what it detected.
	 */
	public constructor(view?: HTMLCanvasElement, touch: boolean = false) {
		super();

		this.view = view ?? this.createRenderingView();
		this.initialized = RenderSystemState.NULL;
		this.resolution = 1;

		this.scene = new Scene();
		this.camera = touch ? new TouchCamera() : new DesktopCamera();
		this.textureBuilder = new TextureBuilder();

		this.camera.connect(this.canvas);
	}

	/**
	 * Initializes the renderer with the provided settings and prepares it for rendering.
	 * @param settings
	 *
	 * @returns A promise that resolves when the renderer is initialized and ready to use.
	 */
	public async init(settings: RenderSystemOptions = {}): Promise<WebGLRenderer> {
		if (this.initialized !== RenderSystemState.NULL) {
			throw new Error("Renderer is already initialized or destroyed");
		}

		this.initialized = RenderSystemState.INITIALIZING;
		this.resolution = settings.resolution ?? 1;

		switch (settings.renderer) {
			case "WebGPU":
				throw new Error("WebGPU is not yet supported");

				this.three = new WebGLRenderer({
					powerPreference: "high-performance",
					...settings.three,
					canvas: this.canvas,
				});

			case "WebGL":
			default:
				this.three = new WebGLRenderer({
					powerPreference: "high-performance",
					...settings.three,
					canvas: this.canvas,
				});
		}

		this.three.setClearColor(settings.backgroundColor ?? "black");

		if (settings.fullscreen) {
			waitForUserGesture().then(() => this.setFullscreen(true));
		}

		this.initialized = RenderSystemState.INITIALIZED;

		this.resize();

		this.observer = new ResizeObserver(() => this.resize());
		this.observer.observe(this.canvas);

		this.emit("init", this.canvas);

		log("Renderer", "Successfully initialized WebGL renderer");

		return this.three;
	}

	/**
	 * The main rendering function that is called on each animation frame. It calculates the time delta since the last frame, runs any registered timers, and renders the scene using the renderer.
	 *
	 * @param now Optional current timestamp in milliseconds, typically provided by requestAnimationFrame.
	 * @returns The time taken to execute the rendering function in milliseconds.
	 * @throws Error if the renderer is not initialized. Call init() before starting the rendering loop.
	 */
	public render(deltaTime: number, now: number = performance.now()): void {
		if (this.initialized !== RenderSystemState.INITIALIZED) {
			throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
		}

		// Emit the render event, allowing external listeners to perform actions before the scene is rendered.
		this.emit("render", deltaTime, now);

		this.camera.update(deltaTime);

		this.three.render(this.scene, this.camera);
	}

	/**
	 * Sets the fullscreen mode of the application.
	 *
	 * @param fullScreen Whether to enable fullscreen mode - Toggles by default.
	 * @returns A promise resolving to the current instance of the RenderSystem.
	 */
	public async setFullscreen(fullScreen: boolean = !this.isFullscreen): Promise<this> {
		if (fullScreen) {
			await document.documentElement.requestFullscreen();
		} else {
			await document.exitFullscreen();
		}

		return this;
	}

	/**
	 * Creates a new HTML canvas element for rendering, with the specified width and height. The canvas is styled to be fixed, fullscreen, and positioned behind other elements.
	 *
	 * @param width The width of the canvas.
	 * @param height The height of the canvas.
	 *
	 * @returns The created canvas element.
	 */
	public createRenderingView(width: string = "100%", height: string = "100%"): HTMLCanvasElement {
		const canvas = document.createElement("canvas");

		// Fullscreen canvas
		canvas.id = "engine-canvas";
		canvas.style.position = "fixed";
		canvas.style.top = "0";
		canvas.style.left = "0";
		canvas.style.width = width;
		canvas.style.height = height;
		canvas.style.zIndex;

		return canvas;
	}

	/** Whether there is a context to draw with: false before `init` and after `destroy`. */
	public get ready(): boolean {
		return this.initialized === RenderSystemState.INITIALIZED;
	}

	/**
	 * Match the drawing buffer to the canvas, at the current `resolution`. Called on its own whenever
	 * the canvas changes size; a game calls it after changing the resolution.
	 */
	public resize(width?: number, height: number | undefined = width): this {
		if (this.initialized !== RenderSystemState.INITIALIZED) {
			throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
		}

		const bounds = this.canvas.getBoundingClientRect();

		width ??= bounds.width * devicePixelRatio;
		height ??= bounds.height * devicePixelRatio;

		this.emit("resize", width, height);

		this.three.setSize(width * this.resolution, height * this.resolution, false);

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();

		return this;
	}

	public destroy(view: boolean = false): void {
		if (this.initialized === RenderSystemState.NULL) {
			throw new Error("Renderer is not initialized");
		}

		if (this.initialized === RenderSystemState.DESTROYED) {
			throw new Error("Renderer is already destroyed");
		}

		this.observer?.disconnect();

		this.camera.destroy();

		if (view) {
			this.canvas.remove();
		}

		this.three.dispose();
		this.three.forceContextLoss();

		this.emit("destroy");

		this.removeAllListeners();
	}

	/**
	 * Sets the HTML canvas element used for rendering. When a new canvas is set, it adds an event listener to handle resizing of the canvas.
	 */
	public set view(value: HTMLCanvasElement) {
		if (value !== this.canvas) {
			this.canvas = value;

			this.observer?.disconnect();
			this.observer?.observe(value);

			// The constructor sets the first view before the camera exists; any later one takes the camera with it.
			if (this.camera !== undefined) {
				this.camera.connect(value);
			}
		}
	}

	/**
	 * Gets the HTML canvas element used for rendering. This allows access to the underlying canvas for further customization or manipulation.
	 */
	public get view(): HTMLCanvasElement {
		return this.canvas;
	}

	/**
	 * Sets the visibility of the canvas element. When set to true, the canvas is displayed; when set to false, the canvas is hidden.
	 */
	public set visible(value: boolean) {
		this.canvas.style.display = value ? "block" : "none";
	}

	/**
	 * Gets the visibility of the canvas element. Returns true if the canvas is currently displayed, and false if it is hidden.
	 */
	public get visible(): boolean {
		return this.canvas.style.display !== "none";
	}

	/**
	 * Sets the width of the canvas element. The width is specified as a string, allowing for CSS units (e.g., "100%", "800px").
	 */
	public set width(value: string) {
		this.canvas.style.width = value;
	}

	/**
	 * Gets the width of the canvas element in pixels. This value is derived from the bounding rectangle of the canvas, providing the actual rendered width on the screen.
	 */
	public get width(): number {
		const bounds = this.canvas.getBoundingClientRect();

		return bounds.width;
	}

	/**
	 * Sets the height of the canvas element. The height is specified as a string, allowing for CSS units (e.g., "100%", "600px").
	 */
	public set height(value: string) {
		this.canvas.style.height = value;
	}

	/**
	 * Gets the height of the canvas element in pixels. This value is derived from the bounding rectangle of the canvas, providing the actual rendered height on the screen.
	 */
	public get height(): number {
		const bounds = this.canvas.getBoundingClientRect();

		return bounds.height;
	}

	/**
	 * Checks if the application is currently in fullscreen mode.
	 */
	public get isFullscreen(): boolean {
		return document.fullscreenElement === this.canvas;
	}
}
