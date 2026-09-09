import { Assets, autoDetectRenderer, Container, RendererPreference, RendererType, type Renderer, type Texture } from "pixi.js";
import { DefaultContainer } from "./createVisuals";
import { log } from "../../../../../shared/utils/logger";
import { RenderSystem } from "../../RenderSystem";
import { Camera } from "./camera";

type RendererSettings = Partial<{
	resolution: number;
	renderer: RendererPreference | RendererPreference[];
	backgroundColor: number;
	antialiasing: boolean;
	fullscreen: boolean;
}>;

export class PixiRenderer extends RenderSystem<Texture> {
	private pixi!: Renderer;
	public world: Container;
	public scene: Container;
	public camera: Camera;

	public constructor(view?: HTMLCanvasElement, stage: Container = new DefaultContainer()) {
		super(view);

		this.camera = new Camera();
		this.scene = stage;
		this.world = new DefaultContainer({ isRenderGroup: true });

		this.scene.addChild(this.world);
	}

	/**
	 * Initializes the renderer with the provided settings and prepares it for rendering.
	 * @param settings
	 *
	 * @returns A promise that resolves when the renderer is initialized and ready to use.
	 */
	public override async init(settings: RendererSettings): Promise<Renderer> {
		const promise = autoDetectRenderer({
			powerPreference: "high-performance",
			backgroundColor: settings.backgroundColor,
			preference: settings.renderer,
			antialias: settings.antialiasing,
			eventMode: import.meta.env.PROD ? "none" : "passive", // Disable event listeners in production for performance
			canvas: this.canvas,
			roundPixels: false,
		});

		promise.then((renderer) => {
			this.pixi = renderer;

			log("Renderer", `Successfully initialized ${RendererType[this.pixi.type]} renderer`);
		});

		await super.init(settings, promise);

		return this.pixi;
	}

	protected runInternalRenderer(): void {
		this.pixi.render(this.scene);
	}

	/** A sprite's texture. Pixi's own `Assets` cache sits behind this and dedupes by URL across renderers. */
	protected async loadAsset(src: string): Promise<Texture> {
		return Assets.load<Texture>(src);
	}

	/**
	 * Unloaded through `Assets`, not `texture.destroy()`: Pixi keys its cache by URL, so destroying the
	 * texture behind its back leaves the cache handing out a destroyed object on the next load.
	 */
	protected disposeAsset(_asset: Texture, src: string): void {
		void Assets.unload(src);
	}

	protected override resize(width?: number, height: number | undefined = width): this {
		// Get canvas size
		const bounds = this.canvas.getBoundingClientRect();

		if (width === undefined) {
			width = bounds.width * devicePixelRatio;
		}

		if (height === undefined) {
			height = bounds.height * devicePixelRatio;
		}

		super.resize(width, height);

		this.pixi.resize(width * this.resolution, height * this.resolution);

		return this;
	}

	public override destroy(view?: boolean): void {
		super.destroy(view);

		this.pixi.destroy();
	}
}
