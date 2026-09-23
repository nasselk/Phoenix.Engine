import { Group, type Material, type Mesh } from "three";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { InfiniteGrid, type InfiniteGridOptions } from "./InfiniteGrid";
import { InfinitePlane, type InfinitePlaneOptions } from "./InfinitePlane";
import Stats from "stats.js";
import type { Engine } from "../../../engine";

export interface EditorViewOptions {
	readonly plane?: InfinitePlaneOptions;
	readonly grid?: InfiniteGridOptions;
	readonly axes?: AxisLinesOptions;
}

export class EditorView extends Group {
	public readonly plane: InfinitePlane;
	public readonly grid: InfiniteGrid;
	public readonly axes: AxisLines;
	private readonly context: Engine<any, any, any, any, any, any, any>;
	private readonly unsubscribers: (() => void)[] = [];
	private readonly wired = new Set<Material & { wireframe: boolean }>();
	private wireframe = false;

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
		this.context = engine;

		this.add(this.plane, this.grid, this.axes);
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
			[this.stats.latency, this.stats.input, this.stats.output],
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
			}),

			this.context.loop.on("frameEnd", () => {
				this.stats.frames.end();
				this.stats.ms.end();
				this.stats.memory.update();
			}),

			this.context.network.on("stats", (stats) => {
				this.stats.input.update(stats.in.bps, 250);
				this.stats.output.update(stats.out.bps, 250);
				this.stats.latency.update(stats.latency, 250);
			}),

			this.context.inputs.onPressInput((event) => {
				switch (event.code) {
					case "KeyF":
						this.toggleCamera();

						break;

					case "KeyV":
						this.toggleWireframe();

						break;
				}
			}),
		);
	}

	public toggleCamera(attach: boolean = this.context.renderer.camera.detached): void {
		const { camera } = this.context.renderer;

		if (attach) {
			camera.reattach();
		} else {
			camera.detach();
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

		for (const unsubscribe of this.unsubscribers) {
			unsubscribe();
		}

		this.removeFromParent();

		for (const panel of Object.values(this.stats)) {
			panel.dom.remove();
		}
	}
}
