import { Group } from "three";
import { AxisLines } from "./AxisLines";
import { InfiniteGrid } from "./InfiniteGrid";
import { InfinitePlane } from "./InfinitePlane";
import Stats from "stats.js";
export class EditorView extends Group {
    constructor({ plane, grid, axes } = {}) {
        super();
        this.pannels = {};
        this.plane = new InfinitePlane(plane);
        this.grid = new InfiniteGrid(grid);
        this.axes = new AxisLines(axes);
        this.add(this.plane, this.grid, this.axes);
    }
    async init(stats) {
        this.pannels.frames = new Stats();
        this.pannels.ms = new Stats();
        this.pannels.memory = new Stats();
        this.pannels.latency = new Stats.Panel("MS ping", "#ff8", "#221");
        this.pannels.input = new Stats.Panel("Bytes ⇓", "#f8f", "#221");
        this.pannels.output = new Stats.Panel("Bytes ⥣", "#8ff", "#221");
        this.pannels.tps = new Stats.Panel("TPS", "#8f8", "#221");
        this.pannels.ms.showPanel(1);
        this.pannels.memory.showPanel(2);
        const rows = [
            [this.pannels.frames, this.pannels.ms, this.pannels.memory],
            [this.pannels.latency, this.pannels.input, this.pannels.output],
        ];
        for (let row = 0; row < rows.length; row++) {
            for (let column = 0; column < rows[row].length; column++) {
                const style = rows[row][column].dom.style;
                style.position = "fixed";
                style.top = `${row * 48}px`;
                style.left = `${column * 80}px`;
                style.opacity = "0.9";
                style.zIndex = "1";
            }
        }
        const container = document.querySelector(stats);
        if (container) {
            for (const panel of Object.values(this.pannels)) {
                container.appendChild(panel.dom);
            }
        }
    }
}
