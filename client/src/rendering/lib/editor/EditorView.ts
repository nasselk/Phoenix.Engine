import Stats from "stats.js";
import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, type Material, Matrix4, type Mesh, type PerspectiveCamera, Quaternion, Vector3 } from "three";
import { normalizeAnglePI } from "../../../../../shared/math/angle";
import { clamp } from "../../../../../shared/math/utils";
import type { Engine } from "../../../engine";
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

/** The outline's far corners, clockwise from the top left, as signs of half its width and height. */
const FRUSTUM_CORNERS = [
	[-1, 1],
	[1, 1],
	[1, -1],
	[-1, -1],
] as const;

/** Radians the camera orbits per pixel dragged on the gizmo, which is small, so faster than a drag in the scene. */
const GIZMO_ORBIT_SPEED = 0.012;

const WORLD_UP = new Vector3(0, 1, 0);
const UNIT_SCALE = new Vector3(1, 1, 1);
const LOOK = new Matrix4();
const PIVOT = new Vector3();
const BACK = new Vector3();
const TURN = new Quaternion();

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
	private flying = false;
	private lastFrames = 0;
	private lastSample = 0;

	/** A swing to a side in progress: from where to where, the point a free camera turns around, and when it started. */
	private readonly snap = {
		active: false,
		start: 0,
		free: false,
		fromYaw: 0,
		toYaw: 0,
		fromPitch: 0,
		toPitch: 0,
		from: new Quaternion(),
		to: new Quaternion(),
		pivot: new Vector3(),
	};

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

				if (this.flying) {
					this.steer();
					this.outline();
				}

				if (this.snap.active) {
					this.swing();
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

			this.context.inputs.onPressInput((event) => {
				switch (event.code) {
					case "KeyV":
						this.toggleWireframe();

						break;
				}
			}),
		);
	}

	/**
	 * Fly the editor's camera with WASD, Shift and the arrows, from where the game's camera is, or go back
	 * to the game's camera. The game's camera keeps following its target meanwhile, outlined by `frustum`.
	 */
	public toggleCamera(attach: boolean = this.flying): void {
		const { renderer } = this.context;
		const { camera } = this;

		this.flying = !attach;
		this.frustum.visible = !attach;

		if (attach) {
			camera.flyForward = camera.flyRight = camera.turn = camera.tilt = 0;
			camera.flyBoost = false;
			renderer.activeCamera = renderer.camera;
		} else {
			renderer.activeCamera = camera.startFrom(renderer.camera);
			this.outline();
		}
	}

	/** Whether the editor's camera is the one drawn. */
	public get isFlying(): boolean {
		return this.flying;
	}

	/** The camera drawn right now: the editor's while it flies, the game's otherwise. What the navigation gizmo shows. */
	public get activeCamera(): PerspectiveCamera {
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

	/** Four edges from the camera to a rectangle `FRUSTUM_LENGTH` ahead, in the camera's own space: 8 segments, 16 points. */
	private static createFrustum(): LineSegments<BufferGeometry, LineBasicMaterial> {
		const geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(16 * 3), 3));
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
		const { frustum } = this;
		const position = frustum.geometry.getAttribute("position") as BufferAttribute;
		const height = Math.tan((game.fov * Math.PI) / 360) * FRUSTUM_LENGTH;
		const width = height * game.aspect;

		for (let corner = 0; corner < 4; corner++) {
			const [x, y] = FRUSTUM_CORNERS[corner]!;
			const [nextX, nextY] = FRUSTUM_CORNERS[(corner + 1) % 4]!;

			position.setXYZ(corner * 4, 0, 0, 0);
			position.setXYZ(corner * 4 + 1, x * width, y * height, -FRUSTUM_LENGTH);
			position.setXYZ(corner * 4 + 2, x * width, y * height, -FRUSTUM_LENGTH);
			position.setXYZ(corner * 4 + 3, nextX * width, nextY * height, -FRUSTUM_LENGTH);
		}

		position.needsUpdate = true;

		frustum.matrixWorld.compose(game.position, game.quaternion, UNIT_SCALE);
	}

	/**
	 * Swing the drawn camera round to look at the scene from that side, like a click on a ball of
	 * Blender's gizmo. The game's camera orbits its target, within its pitch limits; the editor's turns
	 * around the point `distance` ahead of it.
	 */
	public viewFrom(axis: EditorAxis): void {
		const { snap } = this;
		const side = EDITOR_AXES[axis];

		snap.active = true;
		snap.start = performance.now();
		snap.free = this.flying;

		if (snap.free) {
			const { camera } = this;

			snap.pivot.copy(camera.getWorldDirection(PIVOT)).multiplyScalar(camera.distance).add(camera.position);
			snap.from.copy(camera.quaternion);

			// Straight down or up, "up" on screen is a horizontal axis, or the view would have no up at all.
			BACK.set(0, 0, side.y > 0 ? -1 : 1);
			snap.to.setFromRotationMatrix(LOOK.lookAt(side, PIVOT.set(0, 0, 0), side.y === 0 ? WORLD_UP : BACK));

			return;
		}

		const { camera } = this.context.renderer;

		snap.fromYaw = camera.yaw;
		snap.fromPitch = camera.pitch;
		snap.toYaw = side.y === 0 ? camera.yaw + normalizeAnglePI(Math.atan2(side.x, side.z) - camera.yaw) : camera.yaw;
		snap.toPitch = clamp(side.y > 0 ? camera.maxPitch : side.y < 0 ? camera.minPitch : 0, camera.minPitch, camera.maxPitch);
	}

	/**
	 * Orbit the drawn camera by a drag of so many pixels on the gizmo: the game's around its target, the
	 * editor's around the point `distance` ahead of it. Stops a swing in progress.
	 */
	public orbit(x: number, y: number): void {
		this.snap.active = false;

		if (!this.flying) {
			this.context.renderer.camera.rotate(-x * GIZMO_ORBIT_SPEED, y * GIZMO_ORBIT_SPEED);

			return;
		}

		const { camera } = this;

		PIVOT.copy(camera.getWorldDirection(PIVOT)).multiplyScalar(camera.distance).add(camera.position);

		camera.quaternion.premultiply(TURN.setFromAxisAngle(WORLD_UP, -x * GIZMO_ORBIT_SPEED));
		camera.rotateX(-y * GIZMO_ORBIT_SPEED);

		this.around(PIVOT);
	}

	private swing(): void {
		const { snap } = this;
		const progress = Math.min((performance.now() - snap.start) / (SNAP_DURATION * 1000), 1);
		const eased = progress * progress * (3 - 2 * progress);

		if (progress === 1) {
			snap.active = false;
		}

		// Swapping cameras mid-swing ends it where the camera is.
		if (snap.free !== this.flying) {
			snap.active = false;

			return;
		}

		if (snap.free) {
			this.camera.quaternion.slerpQuaternions(snap.from, snap.to, eased);

			this.around(snap.pivot);
		} else {
			const { camera } = this.context.renderer;

			camera.yaw = snap.fromYaw + (snap.toYaw - snap.fromYaw) * eased;
			camera.pitch = snap.fromPitch + (snap.toPitch - snap.fromPitch) * eased;
		}
	}

	/** Put the editor's camera `distance` behind that point, along the way it now faces. */
	private around(pivot: Vector3): void {
		const { camera } = this;

		camera.position.copy(pivot).addScaledVector(BACK.set(0, 0, 1).applyQuaternion(camera.quaternion), camera.distance);
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

		if (this.flying) {
			this.toggleCamera(true);
		}

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
