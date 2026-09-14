import { Group, Mesh, Scene, WebGLRenderer, type Object3D } from "three";
import { OrbitCamera } from "./Camera";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { log } from "../../../../../shared/utils/logger";
import { RenderSystem } from "../../RenderSystem";
import { TextureBuilder } from "./TextureBuilder";

type RendererSettings = Partial<{
	resolution: number;
	backgroundColor: number;
	antialiasing: boolean;
	fullscreen: boolean;
}>;

export class ThreeRenderer extends RenderSystem<Object3D> {
	private three!: WebGLRenderer;
	/** Built once and reused: this is where DRACO/KTX2 decoders and plugins get configured, and every
	 *  model in this renderer should share that setup rather than re-declare it. It holds no cache. */
	private readonly gltf: GLTFLoader;

	/** The 3D scene */
	public scene: Scene;

	/** The 3D world group */
	public world: Group;

	/** The 3D camera */
	public readonly camera: OrbitCamera;

	/** The texture builder for creating textures in the 3D scene */
	public readonly textureBuilder: TextureBuilder;

	public constructor(view?: HTMLCanvasElement) {
		super(view);

		this.scene = new Scene();
		this.camera = new OrbitCamera();
		this.textureBuilder = new TextureBuilder();

		this.camera.connect();

		this.world = new Group();
		this.gltf = new GLTFLoader();

		this.scene.add(this.world);
	}

	/**
	 * Initializes the renderer with the provided settings and prepares it for rendering.
	 * @param settings
	 *
	 * @returns A promise that resolves when the renderer is initialized and ready to use.
	 */
	public override async init(settings: RendererSettings): Promise<WebGLRenderer> {
		this.three = new WebGLRenderer({
			canvas: this.canvas,
			antialias: settings.antialiasing,
			powerPreference: "high-performance",
		});

		this.three.setClearColor(settings.backgroundColor ?? "black");

		await super.init(settings);

		log("Renderer", "Successfully initialized WebGL renderer");

		return this.three;
	}

	protected runInternalRenderer(): void {
		this.camera.update();

		this.three.render(this.scene, this.camera);
	}

	/**
	 * A glTF/GLB model, handed back as its scene graph root rather than the raw glTF wrapper — that is
	 * the part a caller adds to `world`. Animations and cameras stay reachable through the returned
	 * object's own children.
	 */
	protected async loadAsset(src: string): Promise<Object3D> {
		const gltf = await this.gltf.loadAsync(src);

		return gltf.scene;
	}

	/**
	 * Three allocates GPU buffers per geometry, material and texture, and frees none of them when the
	 * object is dropped — walking the tree is the only way to actually release a model.
	 */
	protected disposeAsset(asset: Object3D): void {
		asset.removeFromParent();

		asset.traverse((child) => {
			if (!(child instanceof Mesh)) {
				return;
			}

			child.geometry.dispose();

			for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
				material.dispose();
			}
		});
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

		this.three.setSize(width * this.resolution, height * this.resolution, false);

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();

		return this;
	}

	public override destroy(view?: boolean): void {
		this.camera.destroy();
		this.three.dispose();
		this.three.forceContextLoss();

		super.destroy(view);
	}
}
