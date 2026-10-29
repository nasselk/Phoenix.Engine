import Stats from "stats.js";
import { BufferAttribute, BufferGeometry, Group, type Light, LineBasicMaterial, LineSegments, type Material, type Mesh, Vector3 } from "three";
import type { Engine } from "../../../engine";
import type { ControlledCamera } from "../camera/ControlledCamera";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { EditorCamera } from "./EditorCamera";
import { InfiniteGrid, type InfiniteGridOptions } from "./InfiniteGrid";
import { InfinitePlane, type InfinitePlaneOptions } from "./InfinitePlane";

/** A side to look at the scene from, as the navigation gizmo's balls name them: `x` is from +X, looking back along -X. */
export type EditorAxis = "x" | "y" | "z" | "-x" | "-y" | "-z";

const EDITOR_AXES: Readonly<Record<EditorAxis, Readonly<Vector3>>> = {
	x: new Vector3(1, 0, 0),
	y: new Vector3(0, 1, 0),
	z: new Vector3(0, 0, 1),
	"-x": new Vector3(-1, 0, 0),
	"-y": new Vector3(0, -1, 0),
	"-z": new Vector3(0, 0, -1),
};

/** Seconds a click on the gizmo takes to swing the camera round. */
const SNAP_DURATION = 0.25;

/** How far the game camera's outline reaches while the editor flies its own, in units: its real far plane is too far to see the shape. */
const FRUSTUM_LENGTH = 6;

/**
 * The outline at unit size, in the camera's own space: an edge from the camera to each corner of a
 * rectangle one unit ahead, then the rectangle, clockwise from the top left. 8 segments, 16 points.
 * Stretched to the game camera's field of view and FRUSTUM_LENGTH through its matrix.
 */
// biome-ignore format: one segment per line
const FRUSTUM_POINTS = new Float32Array([
	0, 0, 0, -1, 1, -1,
	0, 0, 0, 1, 1, -1,
	0, 0, 0, 1, -1, -1,
	0, 0, 0, -1, -1, -1,
	-1, 1, -1, 1, 1, -1,
	1, 1, -1, 1, -1, -1,
	1, -1, -1, -1, -1, -1,
	-1, -1, -1, -1, 1, -1,
]);

/** Radians the camera orbits per pixel dragged on the gizmo, which is small, so faster than a drag in the scene. */
const GIZMO_ORBIT_SPEED = 0.012;

const SCALE = new Vector3();

export interface EditorViewOptions {
	readonly plane?: InfinitePlaneOptions;
	readonly grid?: InfiniteGridOptions;
	readonly axes?: AxisLinesOptions;
}

export class EditorView extends Group {
	public readonly plane: InfinitePlane;
	public readonly grid: InfiniteGrid;
	public readonly axes: AxisLines;
	/** The camera the editor flies, while the game's own stays where it is. */
	public readonly camera: EditorCamera;
	/** The game camera's outline, shown while the editor flies its own camera. */
	public readonly frustum: LineSegments<BufferGeometry, LineBasicMaterial>;
	private readonly context: Engine<any, any, any, any, any, any, any>;
	private readonly unsubscribers: (() => void)[] = [];
	private readonly wired = new Set<Material & { wireframe: boolean }>();
	private wireframe = false;
	private statsShown = true;
	private shadows = true;
	/** The lights `toggleShadows` stopped casting, which are exactly the ones it gives their shadows back to. */
	private readonly shadowless = new Set<Light>();
	private lastFrames = 0;
	private lastSample = 0;

	public readonly stats: {
		frames: Stats;
		memory: Stats;
		ms: Stats;
		latency: Stats.Panel;
		input: Stats.Panel;
		output: Stats.Panel;
		tps: Stats.Panel;
	} = {} as any;

	public constructor(engine: Engine<any, any, any, any, any, any, any>, { plane, grid, axes }: EditorViewOptions = {}) {
		super();

		this.plane = new InfinitePlane(plane);
		this.grid = new InfiniteGrid(grid);
		this.axes = new AxisLines(axes);
		this.camera = new EditorCamera();
		this.frustum = EditorView.createFrustum();
		this.context = engine;

		this.add(this.plane, this.grid, this.axes, this.frustum);
	}

	public async init(stats: string): Promise<void> {
		// const module = await import("stats.js");

		// const Stats = module.default;

		this.stats.frames = new Stats();
		this.stats.ms = new Stats();
		this.stats.memory = new Stats();
		this.stats.latency = new Stats.Panel("MS Ping", "#ff8", "#221");
		this.stats.input = new Stats.Panel("BPS ⇓", "#f8f", "#221");
		this.stats.output = new Stats.Panel("BPS ⥣", "#8ff", "#221");
		this.stats.tps = new Stats.Panel("TPS", "#8f8", "#221");

		this.stats.ms.showPanel(1);
		this.stats.memory.showPanel(2);

		const rows = [
			[this.stats.frames, this.stats.ms, this.stats.memory],
			[this.stats.latency, this.stats.input, this.stats.output, this.stats.tps],
		];

		for (let row = 0; row < rows.length; row++) {
			for (let column = 0; column < rows[row]!.length; column++) {
				const style = rows[row]![column]!.dom.style;

				style.position = "fixed";
				style.top = `${row * 48}px`;
				style.left = `${column * 80}px`;
				style.opacity = "0.9";
				style.zIndex = "1";
				style.pointerEvents = "none";
				style.display = this.statsShown ? "" : "none";
			}
		}

		this.lastFrames = this.context.world.framesReceived;
		this.lastSample = performance.now();

		const container = document.querySelector<HTMLDivElement>(stats);

		if (container) {
			for (const panel of Object.values(this.stats)) {
				container.appendChild(panel.dom);
			}
		}

		this.unsubscribers.push(
			this.context.loop.on("frameStart", () => {
				this.stats.frames.begin();
				this.stats.ms.begin();

				if (this.wireframe) {
					this.wireScene();
				}

				const flying = this.isFlying;

				this.frustum.visible = flying;

				if (flying) {
					this.steer();
					this.outline();
				}
			}),

			this.context.loop.on("frameEnd", () => {
				this.stats.frames.end();
				this.stats.ms.end();
				this.stats.memory.update();
			}),

			this.context.network.on("stats", (stats) => {
				const now = performance.now();
				const frames = this.context.world.framesReceived;

				this.stats.input.update(stats.in.bps, 250);
				this.stats.output.update(stats.out.bps, 250);
				this.stats.latency.update(stats.latency, 250);
				this.stats.tps.update(now > this.lastSample ? ((frames - this.lastFrames) * 1000) / (now - this.lastSample) : 0, 120);

				this.lastFrames = frames;
				this.lastSample = now;
			}),
		);
	}

	/**
	 * Fly the editor's camera with WASD, Shift and the arrows, from where the game's camera is, or go back
	 * to the game's camera. The game's camera keeps following its target meanwhile, outlined by `frustum`.
	 */
	public fly(enabled: boolean = !this.isFlying): void {
		const { renderer } = this.context;
		const { camera } = this;

		if (enabled === this.isFlying) {
			return;
		}

		this.frustum.visible = enabled;

		if (enabled) {
			renderer.activeCamera = camera.startFrom(renderer.camera);
			this.outline();
		} else {
			camera.flyForward = camera.flyRight = camera.turn = camera.tilt = 0;
			camera.flyBoost = false;
			renderer.activeCamera = renderer.camera;
		}
	}

	/** Whether the editor's camera is the one drawn. */
	public get isFlying(): boolean {
		return this.context.renderer.activeCamera === this.camera;
	}

	/** The camera drawn right now: the editor's while it flies, the game's otherwise. What the navigation gizmo shows and turns. */
	public get activeCamera(): ControlledCamera {
		return this.context.renderer.activeCamera;
	}

	private steer(): void {
		const { camera } = this;

		camera.flyForward = this.key("KeyW") - this.key("KeyS");
		camera.flyRight = this.key("KeyD") - this.key("KeyA");
		camera.flyBoost = this.key("ShiftLeft") + this.key("ShiftRight") > 0;
		camera.turn = this.key("ArrowRight") - this.key("ArrowLeft");
		camera.tilt = this.key("ArrowUp") - this.key("ArrowDown");
	}

	private key(code: string): number {
		return this.context.inputs.isInputPressed(code) ? 1 : 0;
	}

	/** The game camera's outline, built once at unit size: `outline` only places and stretches it. */
	private static createFrustum(): LineSegments<BufferGeometry, LineBasicMaterial> {
		const geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(FRUSTUM_POINTS, 3));
		const frustum = new LineSegments(geometry, new LineBasicMaterial({ color: 0xffaa00 }));

		frustum.visible = false;
		frustum.frustumCulled = false;
		// Placed in the world as the game's camera is, whatever this view's own transform.
		frustum.matrixAutoUpdate = false;
		frustum.matrixWorldAutoUpdate = false;

		return frustum;
	}

	/** Match the outline to where the game's camera is and what it shows. */
	private outline(): void {
		const game = this.context.renderer.camera;
		const height = Math.tan((game.fov * Math.PI) / 360) * FRUSTUM_LENGTH;

		this.frustum.matrixWorld.compose(game.position, game.quaternion, SCALE.set(height * game.aspect, height, FRUSTUM_LENGTH));
	}

	/** Swing the drawn camera round to look at the scene from that side, like a click on a ball of Blender's gizmo. */
	public viewFrom(axis: EditorAxis): void {
		this.activeCamera.lookFrom(EDITOR_AXES[axis], SNAP_DURATION);
	}

	/** Orbit the drawn camera by a drag of so many pixels on the gizmo. Stops a swing in progress. */
	public orbit(x: number, y: number): void {
		this.activeCamera.orbit(-x * GIZMO_ORBIT_SPEED, y * GIZMO_ORBIT_SPEED);
	}

	/**
	 * Turn every shadow in the scene off, or back on. Off, each light casting one stops and is remembered;
	 * on, those lights cast again, and only those, so a light the game keeps dark stays dark.
	 */
	public toggleShadows(enabled: boolean = !this.shadows): void {
		if (enabled === this.shadows) {
			return;
		}

		this.shadows = enabled;

		if (enabled) {
			for (const light of this.shadowless) {
				light.castShadow = true;
			}

			this.shadowless.clear();
		} else {
			this.context.renderer.scene.traverse((object) => {
				if ((object as Light).isLight && object.castShadow) {
					object.castShadow = false;
					this.shadowless.add(object as Light);
				}
			});
		}
	}

	/** Show or hide the floor, its grid and the axes. */
	public toggleGrid(enabled: boolean = !this.grid.visible): void {
		this.plane.visible = this.grid.visible = this.axes.visible = enabled;
	}

	/** Show or hide the FPS, ping, bandwidth and TPS panels. */
	public toggleStats(enabled: boolean = !this.statsShown): void {
		this.statsShown = enabled;

		for (const panel of Object.values(this.stats)) {
			panel.dom.style.display = enabled ? "" : "none";
		}
	}

	/** Draws every mesh in the scene as its triangles, except the editor's own and text. */
	public toggleWireframe(enabled: boolean = !this.wireframe): void {
		this.wireframe = enabled;

		if (enabled) {
			this.wireScene();
		} else {
			for (const material of this.wired) {
				material.wireframe = false;
			}

			this.wired.clear();
		}
	}

	private wireScene(): void {
		for (const child of this.context.renderer.scene.children) {
			if (child === this) {
				continue;
			}

			child.traverse((object) => {
				const { isMesh, material } = object as Mesh;

				if (!isMesh) {
					return;
				}

				for (const each of Array.isArray(material) ? material : [material]) {
					const candidate = each as Material & { wireframe?: boolean; isShaderMaterial?: boolean; isDerivedMaterial?: boolean };

					if (candidate.wireframe === false && !candidate.isShaderMaterial && !candidate.isDerivedMaterial) {
						candidate.wireframe = true;

						this.wired.add(candidate as Material & { wireframe: boolean });
					}
				}
			});
		}
	}

	public destroy(): void {
		this.toggleWireframe(false);
		this.toggleShadows(true);

		this.fly(false);

		this.camera.destroy();
		this.frustum.geometry.dispose();
		this.frustum.material.dispose();

		for (const unsubscribe of this.unsubscribers) {
			unsubscribe();
		}

		this.removeFromParent();

		for (const panel of Object.values(this.stats)) {
			panel.dom.remove();
		}
	}
}
