import { EventEmitter } from "../../../shared/utils/EventEmitter";
import { waitForUserGesture } from "../utils/gesture";

type RenderSystemEvents = {
	init: [renderer: HTMLCanvasElement];
	/** `deltaTime` is in seconds; `now` is a millisecond timestamp. */
	render: [deltaTime: number, now: number];
	resize: [width: number, height: number];
	load: [id: string];
	loaderror: [id: string, error: unknown];
	destroy: [];
};

/**
 * One loaded asset and the URL it came from.
 *
 * The source is kept because disposal is not always a method on the asset itself — Pixi hands its
 * cache back a URL, not a texture — so a renderer needs both halves to let go of one cleanly.
 */
type RenderAsset<A> = {
	readonly src: string;
	readonly asset: A;
};

export type RendererKind = "2D" | "3D";

export const enum RenderSystemState {
	NULL,
	INITIALIZING,
	INITIALIZED,
	DESTROYED,
}

/**
 * The renderer-agnostic half of a rendering backend.
 *
 * `Asset` is whatever the backend loads and draws: a Pixi `Texture` for the 2D renderer, a Three
 * `Object3D` for the 3D one. The registry, deduplication and teardown below are identical for both,
 * so they live here; the two hooks that actually know a file format are abstract.
 */
export abstract class RenderSystem<Asset = unknown> extends EventEmitter<RenderSystemEvents> {
	protected canvas!: HTMLCanvasElement;

	/** The current state of the rendering system. */
	public initialized: RenderSystemState;

	/** The resolution of the renderer. */
	public resolution: number;

	/** Assets that finished loading, by the id they were registered under. */
	protected readonly assets: Map<string, RenderAsset<Asset>>;

	/** Loads still in flight, so a second `load()` of the same id joins the first instead of racing it. */
	private readonly loading: Map<string, Promise<Asset>>;

	private observer?: ResizeObserver;

	protected abstract runInternalRenderer(): void;

	/** Pull one asset off the network. The backend picks the loader; the base class owns the bookkeeping. */
	protected abstract loadAsset(src: string): Promise<Asset>;

	/** Release everything an asset holds — GPU buffers, cache entries, the lot. */
	protected abstract disposeAsset(asset: Asset, src: string): void;

	public constructor(view?: HTMLCanvasElement) {
		super();

		this.view = view ?? this.createRenderingView();
		this.initialized = RenderSystemState.NULL;
		this.resolution = 1;
		this.assets = new Map();
		this.loading = new Map();
	}

	/**
	 * Register and load an asset under `id`.
	 *
	 * Loading is genuinely asynchronous here, unlike a sound, so the same id asked for twice while
	 * the first request is still open returns that same promise rather than fetching twice. An
	 * already-loaded id resolves immediately and never re-fetches — call `remove()` first to replace one.
	 */
	public load(id: string, src: string): Promise<Asset> {
		const loaded = this.assets.get(id);

		if (loaded !== undefined) {
			return Promise.resolve(loaded.asset);
		}

		const pending = this.loading.get(id);

		if (pending !== undefined) {
			return pending;
		}

		const promise = this.loadAsset(src)
			.then((asset) => {
				this.loading.delete(id);
				this.assets.set(id, { src, asset });

				this.emit("load", id);

				return asset;
			})
			.catch((error: unknown) => {
				this.loading.delete(id);

				// Surfaced as an event as well as a rejection: a missing texture is usually something a
				// game wants to log or substitute, not something every call site wants to try/catch.
				this.emit("loaderror", id, error);

				throw error;
			});

		this.loading.set(id, promise);

		return promise;
	}

	/** The asset behind an id, or `undefined` while it is still loading or was never registered. */
	public get(id: string): Asset | undefined {
		return this.assets.get(id)?.asset;
	}

	/** Whether `id` has finished loading and is safe to draw this frame. */
	public has(id: string): boolean {
		return this.assets.has(id);
	}

	/** Dispose an asset and forget the id. A load still in flight is left to finish and is not registered. */
	public remove(id: string): void {
		const entry = this.assets.get(id);

		if (entry === undefined) {
			return;
		}

		this.assets.delete(id);

		this.disposeAsset(entry.asset, entry.src);
	}

	/**
	 * Initializes the renderer with the provided settings and prepares it for rendering.
	 * @param settings
	 *
	 * @returns A promise that resolves when the renderer is initialized and ready to use.
	 */
	public async init(settings: Partial<{ resolution: number; fullscreen: boolean }>, promise?: Promise<any>): Promise<any> {
		if (this.initialized !== RenderSystemState.NULL) {
			throw new Error("Renderer is already initialized or destroyed");
		}

		this.initialized = RenderSystemState.INITIALIZING;
		this.resolution = settings.resolution ?? 1;

		if (settings.fullscreen) {
			waitForUserGesture().then(() => this.setFullscreen(true));
		}

		await promise;

		this.initialized = RenderSystemState.INITIALIZED;

		this.resize();

		this.observer = new ResizeObserver(() => this.resize());
		this.observer.observe(this.canvas);

		this.emit("init", this.canvas);
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

		// Render the scene graph
		this.runInternalRenderer();
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

	protected resize(width: number = 0, height: number = width): this {
		if (this.initialized !== RenderSystemState.INITIALIZED) {
			throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
		}

		this.emit("resize", width, height);

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

		if (view) {
			this.canvas.remove();
		}

		for (const id of [...this.assets.keys()]) {
			this.remove(id);
		}

		this.loading.clear();

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
