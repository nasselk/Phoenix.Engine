import { type ColorRepresentation, NoToneMapping, Scene, type ShadowMapType, type ToneMapping, WebGLRenderer, type WebGLRendererParameters } from "three";
import type { WebGPURenderer } from "three/webgpu";
import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { log } from "../../../shared/utils/logger";
import type { AssetManager } from "../assets/AssetManager";
import { waitForUserGesture } from "../utils/gesture";
import { Batcher } from "./lib/Batcher";
import { Camera } from "./lib/camera/Camera";
import { TextureBuilder } from "./lib/TextureBuilder";

type RenderSystemEvents = {
	init: [renderer: HTMLCanvasElement];
	render: [deltaTime: number, now: number];
	resize: [width: number, height: number];
	destroy: [];
};

export type RenderSystemOptions = {
	/** "WebGPU" uses three.js's WebGPURenderer, loaded only then, which falls back to WebGL 2 where WebGPU is missing. It draws the built-in materials, not `ShaderMaterial` or `onBeforeCompile` patches. */
	readonly renderer?: "WebGL" | "WebGPU";
	readonly resolution?: number;
	readonly fullscreen?: boolean;
	readonly backgroundColor?: ColorRepresentation;
	/** How shadow edges are filtered, e.g. `PCFShadowMap`. Unset, nothing casts a shadow. */
	readonly shadows?: ShadowMapType;
	/** How lit colours past white are brought back into range, e.g. `NeutralToneMapping`. Unset, they are clipped. */
	readonly toneMapping?: ToneMapping;
	/** Brightness before tone mapping. Defaults to 1. */
	readonly exposure?: number;
	/** Passed to the WebGL renderer; the WebGPU one takes `antialias`, `alpha`, `depth`, `stencil` and `logarithmicDepthBuffer` from it. */
	readonly three?: Omit<WebGLRendererParameters, "canvas">;
};

export enum RenderSystemState {
	NULL,
	INITIALIZING,
	INITIALIZED,
	DESTROYED,
}

/** The three.js renderer: the canvas, the WebGL or WebGPU context, the scene and the cameras. */
export class RenderSystem extends EventEmitter<RenderSystemEvents> {
	protected canvas!: HTMLCanvasElement;

	public readonly internals!: WebGLRenderer | WebGPURenderer;

	/** The 3D scene */
	public readonly scene: Scene;

	/** The game's camera. It keeps updating every frame, drawn or not. */
	public camera: Camera;

	/** The texture builder for creating textures in the 3D scene */
	public readonly textureBuilder: TextureBuilder;

	/** Draws static scenery in few draw calls: `batcher.batch(scenery)`. What it makes is freed with the renderer. */
	public readonly batcher: Batcher;

	/** The current state of the rendering system. */
	public initialized: RenderSystemState;

	/** A fraction of the screen's native resolution: 1 draws one pixel per device pixel, 0.5 half as many across. Call `resize()` after changing it. */
	public resolution: number;

	private observer?: ResizeObserver;

	private active: Camera;

	/** The canvas's shape at the last resize, which a camera made active is fitted to. */
	private aspect = 1;

	public constructor(assets: AssetManager, view?: HTMLCanvasElement) {
		super();

		this.view = view ?? this.createRenderingView();
		this.initialized = RenderSystemState.NULL;
		this.resolution = 1;

		this.scene = new Scene();
		this.camera = new Camera();
		this.active = this.camera;
		this.textureBuilder = new TextureBuilder(assets);
		this.batcher = new Batcher();

		this.camera.connect(this.canvas);
	}

	/**
	 * The camera the scene is drawn from, and the only one that hears the canvas's mouse and touch:
	 * `camera` until something else is set, such as the editor's flying camera. Set `camera` back to
	 * return to the game's view.
	 */
	public get activeCamera(): Camera {
		return this.active;
	}

	public set activeCamera(camera: Camera) {
		if (camera === this.active) {
			return;
		}

		this.active.destroy();
		this.active = camera;

		camera.connect(this.canvas);
		camera.fit(this.aspect);
	}

	/**
	 * Initializes the renderer with the provided settings and prepares it for rendering.
	 * @param settings
	 *
	 * @returns A promise that resolves when the renderer is initialized and ready to use.
	 */
	public async init(settings: RenderSystemOptions = {}): Promise<WebGLRenderer | WebGPURenderer> {
		if (this.initialized !== RenderSystemState.NULL) {
			throw new Error("Renderer is already initialized or destroyed");
		}

		this.initialized = RenderSystemState.INITIALIZING;
		this.resolution = settings.resolution ?? 1;

		(this as { internals: WebGLRenderer | WebGPURenderer }).internals = settings.renderer === "WebGPU" ? await this.createWebGPURenderer(settings.three) : new WebGLRenderer({ powerPreference: "high-performance", ...settings.three, canvas: this.canvas });

		this.internals.setClearColor(settings.backgroundColor ?? "black");

		this.internals.shadowMap.enabled = settings.shadows !== undefined;
		this.internals.shadowMap.type = settings.shadows ?? this.internals.shadowMap.type;
		this.internals.toneMapping = settings.toneMapping ?? NoToneMapping;
		this.internals.toneMappingExposure = settings.exposure ?? 1;

		if (settings.fullscreen) {
			this.setFullscreen(settings.fullscreen);
		}

		this.initialized = RenderSystemState.INITIALIZED;

		this.resize();

		this.observer = new ResizeObserver(() => this.resize());
		this.observer.observe(this.canvas);

		this.emit("init", this.canvas);

		log("Renderer", `Successfully initialized the ${this.backend} renderer`);

		return this.internals;
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

		if (this.active !== this.camera) {
			this.active.update(deltaTime);
		}

		this.internals.render(this.scene, this.active);
	}

	/**
	 * Sets the fullscreen mode of the application.
	 *
	 * @param fullScreen Whether to enable fullscreen mode - Toggles by default.
	 * @returns A promise resolving to the current instance of the RenderSystem.
	 */
	public async setFullscreen(fullScreen: boolean = !this.isFullscreen): Promise<this> {
		if (fullScreen === this.isFullscreen) {
			return this;
		}

		await waitForUserGesture();

		if (fullScreen === this.isFullscreen) {
			return this;
		}

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

		return canvas;
	}

	/** What draws: "WebGL", "WebGPU", or "WebGPU (WebGL 2)" when WebGPU was asked for on a browser without it. */
	public get backend(): string {
		if (this.internals instanceof WebGLRenderer) {
			return "WebGL";
		}

		return (this.internals.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGPU (WebGL 2)";
	}

	private async createWebGPURenderer(three: RenderSystemOptions["three"] = {}): Promise<WebGPURenderer> {
		const { WebGPURenderer } = await import("three/webgpu");
		const { antialias, alpha, depth, stencil, logarithmicDepthBuffer } = three;
		const renderer = new WebGPURenderer({ canvas: this.canvas, powerPreference: "high-performance", antialias, alpha, depth, stencil, logarithmicDepthBuffer });
		const { library } = renderer;
		const lightNodeClass = library.getLightNodeClass.bind(library);

		library.getLightNodeClass = (light) => {
			for (let type: typeof light | null = light; type !== null && type !== Function.prototype; type = Object.getPrototypeOf(type)) {
				const found = lightNodeClass(type);

				if (found !== null) {
					return found;
				}
			}

			return null;
		};

		await renderer.init();

		return renderer;
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

		this.internals.setSize(width * this.resolution, height * this.resolution, false);

		this.aspect = width / height;

		this.camera.fit(this.aspect);

		if (this.active !== this.camera) {
			this.active.fit(this.aspect);
		}

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

		this.active.destroy();
		this.camera.destroy();
		this.batcher.destroy();

		if (view) {
			this.canvas.remove();
		}

		this.internals.dispose();

		if (this.internals instanceof WebGLRenderer) {
			this.internals.forceContextLoss();
		}

		this.initialized = RenderSystemState.DESTROYED;

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

			// The constructor sets the first view before the camera exists; any later one takes the active camera with it.
			if (this.active !== undefined) {
				this.active.connect(value);
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
		return document.fullscreenElement !== null;
	}
}
