import { Group } from "three";
import { AxisLines, type AxisLinesOptions } from "./AxisLines";
import { InfiniteGrid, type InfiniteGridOptions } from "./InfiniteGrid";
import { InfinitePlane, type InfinitePlaneOptions } from "./InfinitePlane";
import Stats from "stats.js";

export interface EditorViewOptions {
	readonly plane?: InfinitePlaneOptions;
	readonly grid?: InfiniteGridOptions;
	readonly axes?: AxisLinesOptions;
}

export class EditorView extends Group {
	public readonly plane: InfinitePlane;
	public readonly grid: InfiniteGrid;
	public readonly axes: AxisLines;

	public readonly pannels: {
		frames: Stats;
		memory: Stats;
		ms: Stats;
		latency: Stats.Panel;
		input: Stats.Panel;
		output: Stats.Panel;
		tps: Stats.Panel;
	} = {} as any;

	public constructor({ plane, grid, axes }: EditorViewOptions = {}) {
		super();

		this.plane = new InfinitePlane(plane);
		this.grid = new InfiniteGrid(grid);
		this.axes = new AxisLines(axes);

		this.add(this.plane, this.grid, this.axes);
	}

	public async init(stats: string): Promise<void> {
		//const module = await import("stats.js");

		//	const Stats = module.default;

		this.pannels.frames = new Stats();
		this.pannels.ms = new Stats();
		this.pannels.memory = new Stats();
		this.pannels.latency = new Stats.Panel("MS ping", "#ff8", "#221");
		this.pannels.input = new Stats.Panel("Bytes ⇓", "#f8f", "#221");
		this.pannels.output = new Stats.Panel("Bytes ⥣", "#8ff", "#221");
		this.pannels.tps = new Stats.Panel("TPS", "#8f8", "#221");

		this.pannels.ms.showPanel(1);
		this.pannels.memory.showPanel(2);

		// Two rows of 80×48 panels. A Stats is a div that is already position:fixed, but a Panel is a bare
		// canvas with no position at all — and top/left/z-index only apply to positioned elements, so
		// the second row has to be made fixed or it just flows under the first.
		const rows = [
			[this.pannels.frames, this.pannels.ms, this.pannels.memory],
			[this.pannels.latency, this.pannels.input, this.pannels.output],
		];

		for (let row = 0; row < rows.length; row++) {
			for (let column = 0; column < rows[row]!.length; column++) {
				const style = rows[row]![column]!.dom.style;

				style.position = "fixed";
				style.top = `${row * 48}px`;
				style.left = `${column * 80}px`;
				style.opacity = "0.9";
				style.zIndex = "1";
			}
		}

		const container = document.querySelector<HTMLDivElement>(stats);

		if (container) {
			for (const panel of Object.values(this.pannels)) {
				container.appendChild(panel.dom);
			}
		}
	}
}
