import { autoDetectRenderer, Container, RendererPreference, RendererType, type Renderer } from "pixi.js";

import { DefaultContainer } from "./utils/createVisuals";

import { Timer } from "@utils/timers/timer";

import { clamp } from "@libs/math/utils";

import { waitForUserGesture } from "../utils/utils";

import { log } from "@utils/logger";

import Game from "../game";
import { EventEmitter } from "@utils/EventEmitter";

type RenderSystemEvents = {
	init: [renderer: Renderer];
	render: [deltaTime: number, now: number];
	resize: [width: number, height: number];
	start: [];
	stop: [];
};

export class RenderSystem extends EventEmitter<RenderSystemEvents> {
	public readonly canvas: HTMLCanvasElement;
	public readonly world: Container;
	public readonly scene: Container;
	public renderer!: Renderer;
	public initialized: boolean | "initializing";
	public ready!: Promise<Renderer>;
	private lastFrameTime: number;
	public resolution: number;
	public paused: boolean;
	public UIScale: number;
	public frames: number;
	private loop?: number;

	public constructor(stage: Container = new DefaultContainer()) {
		super();

		this.initialized = false;
		this.paused = true;
		this.canvas = this.createCanvas();
		this.scene = stage;
		this.world = new DefaultContainer({ isRenderGroup: true });
		this.lastFrameTime = 0;
		this.resolution = 1;
		this.UIScale = 1;
		this.frames = 0;

		this.scene.addChild(this.world);
	}

	/**
	 * Initializes the renderer with the provided settings and prepares it for rendering.
	 * @param settings
	 *
	 * @returns A promise that resolves when the renderer is initialized and ready to use.
	 */

	public async init(settings: typeof Game.settings.rendering): Promise<Renderer> {
		this.initialized = "initializing";
		this.resolution = settings.resolution;

		document.body.appendChild(this.canvas);

		this.ready = autoDetectRenderer({
			powerPreference: "high-performance",
			backgroundColor: settings.backgroundColor,
			preference: settings.renderer as RendererPreference | RendererPreference[],
			eventMode: import.meta.env.PROD ? "none" : "passive", // Disable event listeners in production for performance
			antialias: settings.antialiasing,
			canvas: this.canvas,
			roundPixels: false,
		});

		this.setListeners(settings);

		this.renderer = await this.ready;
		this.initialized = true;

		log("Renderer", `Successfully initated ${RendererType[this.renderer.type]} renderer`);

		Game.textureBuilder.setRenderer(this.renderer);
		Game.textureBuilder.generateDefaults();
		Game.map.init();
		Game.minimap.init();

		this.resize();

		this.emit("init", this.renderer);

		return this.renderer;
	}

	/**
	 * Starts the rendering loop, allowing the renderer to continuously update and render the scene.
	 * If the rendering loop is already running, this method has no effect.
	 *
	 * @returns The current instance of the RenderSystem for method chaining.
	 * @throws Error if the renderer is not initialized. Call init() before starting the rendering loop.
	 */
	public start(): this {
		if (!this.initialized) {
			throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
		}

		if (this.paused) {
			Game.loop.canvas.style.display = "block";

			this.loop = requestAnimationFrame(this.render.bind(this));
			this.paused = false;

			log("Renderer", "The rendering loop has started");

			this.emit("start");
		}

		return this;
	}

	/**
	 * Stops the rendering loop, halting the continuous update and rendering of the scene.
	 * If the rendering loop is already stopped, this method has no effect.
	 *
	 * @returns The current instance of the RenderSystem for method chaining.
	 * @throws Error if the renderer is not initialized. Call init() before stopping the rendering loop.
	 */
	public stop(): this {
		if (!this.initialized) {
			throw new Error("Renderer is not initialized. Call init() before stopping the rendering loop.");
		}

		if (!this.paused) {
			if (this.loop) {
				cancelAnimationFrame(this.loop);
			}

			this.paused = true;

			log("Renderer", "The rendering loop has stopped");

			this.emit("stop");
		}

		return this;
	}

	/**
	 * The main rendering function that is called on each animation frame. It calculates the time delta since the last frame, runs any registered timers, and renders the scene using the renderer.
	 *
	 * @param now Optional current timestamp in milliseconds, typically provided by requestAnimationFrame.
	 * @returns The time taken to execute the rendering function in milliseconds.
	 * @throws Error if the renderer is not initialized. Call init() before starting the rendering loop.
	 */
	private render(now: number = performance.now()): number {
		if (!this.initialized) {
			throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
		}

		this.loop = requestAnimationFrame(this.render.bind(this));

		const minDeltaTime = 1000 / (Game.settings.rendering["FPS-CAP"] || Infinity);
		const deltaTime = clamp(now - this.lastFrameTime, 1, 50);

		// Account of the FPS cap
		if (deltaTime >= minDeltaTime && !document.hidden) {
			// Start recording statistics
			Game.stats.pannels.frames?.begin();
			Game.stats.pannels.ms?.begin();

			// Run timers registered in "precise" mode
			Timer.runAll(now);

			this.lastFrameTime = now;
			this.frames++;

			this.emit("render", deltaTime, now);

			// Render the overall scene
			this.renderer.render(this.scene);

			// Update statistics (for the engine)
			Game.stats.pannels.frames?.end();
			Game.stats.pannels.ms?.end();

			Game.stats.pannels.memory?.update();
			Game.stats.pannels.latency?.update(Game.latency, 250);
		}

		return performance.now() - now;
	}

	/**
	 * Resizes the rendering canvas and updates the UI scale.
	 *
	 * @param width The new width of the canvas - Defaults to window width.
	 * @param height The new height of the canvas - Defaults to window height.
	 *
	 * @returns The current instance of the RenderSystem for method chaining.
	 * @throws Error if the renderer is not initialized. Call init() before resizing the canvas.
	 */
	public resize(width: number = document.documentElement.clientWidth * devicePixelRatio, height: number = document.documentElement.clientHeight * devicePixelRatio): this {
		if (!this.initialized) {
			throw new Error("Renderer is not initialized. Call init() before starting the rendering loop.");
		}

		// Resize canvas
		this.renderer.resize(width * this.resolution, height * this.resolution);

		this.canvas.style.width = `${document.documentElement.clientWidth}px`;
		this.canvas.style.height = `${document.documentElement.clientHeight}px`;

		// Resize the scale
		this.UIScale = Math.min(this.canvas.width, this.canvas.height) / 1080;

		this.emit("resize", width, height);

		return this;
	}

	/**
	 * Sets the fullscreen mode of the application.
	 *
	 * @param fullScreen Whether to enable fullscreen mode - Toggles by default.
	 * @returns A promise resolving to the current instance of the RenderSystem.
	 */
	public async setFullscreen(fullScreen: boolean = !Game.settings.rendering.fullscreen): Promise<this> {
		const isFullScreen = !!document.fullscreenElement;

		if (isFullScreen === fullScreen) {
			return this;
		} else if (fullScreen) {
			await document.documentElement.requestFullscreen();
		} else {
			await document.exitFullscreen();
		}

		return this;
	}

	private createCanvas(): HTMLCanvasElement {
		const canvas = document.createElement("canvas");

		// Fullscreen canvas
		canvas.style.position = "fixed";
		canvas.style.top = "0";
		canvas.style.left = "0";
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		canvas.style.zIndex = "-1";

		return canvas;
	}

	private setListeners(settings: typeof Game.settings.rendering): this {
		// Save fullscreen state in settings
		window.addEventListener("fullscreenchange", () => {
			const isFullScreen = !!document.fullscreenElement;

			Game.settings.rendering.fullscreen = isFullScreen;
		});

		// Toggle fullscreen on load
		waitForUserGesture().then(() => this.toggleFullScreen(settings.fullscreen));

		// Resize all elements when resizing the window
		window.addEventListener("resize", () => this.resize());

		return this;
	}
}
