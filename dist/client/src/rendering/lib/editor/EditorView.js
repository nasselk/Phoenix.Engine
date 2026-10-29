import Stats from "stats.js";
import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Vector3 } from "three";
import { AxisLines } from "./AxisLines";
import { EditorCamera } from "./EditorCamera";
import { InfiniteGrid } from "./InfiniteGrid";
import { InfinitePlane } from "./InfinitePlane";
const EDITOR_AXES = {
    x: new Vector3(1, 0, 0),
    y: new Vector3(0, 1, 0),
    z: new Vector3(0, 0, 1),
    "-x": new Vector3(-1, 0, 0),
    "-y": new Vector3(0, -1, 0),
    "-z": new Vector3(0, 0, -1),
};
const SNAP_DURATION = 0.25;
const FRUSTUM_LENGTH = 6;
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
const GIZMO_ORBIT_SPEED = 0.012;
const SCALE = new Vector3();
export class EditorView extends Group {
    constructor(engine, { plane, grid, axes } = {}) {
        super();
        this.unsubscribers = [];
        this.wired = new Set();
        this.wireframe = false;
        this.statsShown = true;
        this.shadows = true;
        this.shadowless = new Set();
        this.lastFrames = 0;
        this.lastSample = 0;
        this.stats = {};
        this.plane = new InfinitePlane(plane);
        this.grid = new InfiniteGrid(grid);
        this.axes = new AxisLines(axes);
        this.camera = new EditorCamera();
        this.frustum = EditorView.createFrustum();
        this.context = engine;
        this.add(this.plane, this.grid, this.axes, this.frustum);
    }
    async init(stats) {
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
            for (let column = 0; column < rows[row].length; column++) {
                const style = rows[row][column].dom.style;
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
        const container = document.querySelector(stats);
        if (container) {
            for (const panel of Object.values(this.stats)) {
                container.appendChild(panel.dom);
            }
        }
        this.unsubscribers.push(this.context.loop.on("frameStart", () => {
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
        }), this.context.loop.on("frameEnd", () => {
            this.stats.frames.end();
            this.stats.ms.end();
            this.stats.memory.update();
        }), this.context.network.on("stats", (stats) => {
            const now = performance.now();
            const frames = this.context.world.framesReceived;
            this.stats.input.update(stats.in.bps, 250);
            this.stats.output.update(stats.out.bps, 250);
            this.stats.latency.update(stats.latency, 250);
            this.stats.tps.update(now > this.lastSample ? ((frames - this.lastFrames) * 1000) / (now - this.lastSample) : 0, 120);
            this.lastFrames = frames;
            this.lastSample = now;
        }));
    }
    fly(enabled = !this.isFlying) {
        const { renderer } = this.context;
        const { camera } = this;
        if (enabled === this.isFlying) {
            return;
        }
        this.frustum.visible = enabled;
        if (enabled) {
            renderer.activeCamera = camera.startFrom(renderer.camera);
            this.outline();
        }
        else {
            camera.flyForward = camera.flyRight = camera.turn = camera.tilt = 0;
            camera.flyBoost = false;
            renderer.activeCamera = renderer.camera;
        }
    }
    get isFlying() {
        return this.context.renderer.activeCamera === this.camera;
    }
    get activeCamera() {
        return this.context.renderer.activeCamera;
    }
    steer() {
        const { camera } = this;
        camera.flyForward = this.key("KeyW") - this.key("KeyS");
        camera.flyRight = this.key("KeyD") - this.key("KeyA");
        camera.flyBoost = this.key("ShiftLeft") + this.key("ShiftRight") > 0;
        camera.turn = this.key("ArrowRight") - this.key("ArrowLeft");
        camera.tilt = this.key("ArrowUp") - this.key("ArrowDown");
    }
    key(code) {
        return this.context.inputs.isInputPressed(code) ? 1 : 0;
    }
    static createFrustum() {
        const geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(FRUSTUM_POINTS, 3));
        const frustum = new LineSegments(geometry, new LineBasicMaterial({ color: 0xffaa00 }));
        frustum.visible = false;
        frustum.frustumCulled = false;
        frustum.matrixAutoUpdate = false;
        frustum.matrixWorldAutoUpdate = false;
        return frustum;
    }
    outline() {
        const game = this.context.renderer.camera;
        const height = Math.tan((game.fov * Math.PI) / 360) * FRUSTUM_LENGTH;
        this.frustum.matrixWorld.compose(game.position, game.quaternion, SCALE.set(height * game.aspect, height, FRUSTUM_LENGTH));
    }
    viewFrom(axis) {
        this.activeCamera.lookFrom(EDITOR_AXES[axis], SNAP_DURATION);
    }
    orbit(x, y) {
        this.activeCamera.orbit(-x * GIZMO_ORBIT_SPEED, y * GIZMO_ORBIT_SPEED);
    }
    toggleShadows(enabled = !this.shadows) {
        if (enabled === this.shadows) {
            return;
        }
        this.shadows = enabled;
        if (enabled) {
            for (const light of this.shadowless) {
                light.castShadow = true;
            }
            this.shadowless.clear();
        }
        else {
            this.context.renderer.scene.traverse((object) => {
                if (object.isLight && object.castShadow) {
                    object.castShadow = false;
                    this.shadowless.add(object);
                }
            });
        }
    }
    toggleGrid(enabled = !this.grid.visible) {
        this.plane.visible = this.grid.visible = this.axes.visible = enabled;
    }
    toggleStats(enabled = !this.statsShown) {
        this.statsShown = enabled;
        for (const panel of Object.values(this.stats)) {
            panel.dom.style.display = enabled ? "" : "none";
        }
    }
    toggleWireframe(enabled = !this.wireframe) {
        this.wireframe = enabled;
        if (enabled) {
            this.wireScene();
        }
        else {
            for (const material of this.wired) {
                material.wireframe = false;
            }
            this.wired.clear();
        }
    }
    wireScene() {
        for (const child of this.context.renderer.scene.children) {
            if (child === this) {
                continue;
            }
            child.traverse((object) => {
                const { isMesh, material } = object;
                if (!isMesh) {
                    return;
                }
                for (const each of Array.isArray(material) ? material : [material]) {
                    const candidate = each;
                    if (candidate.wireframe === false && !candidate.isShaderMaterial && !candidate.isDerivedMaterial) {
                        candidate.wireframe = true;
                        this.wired.add(candidate);
                    }
                }
            });
        }
    }
    destroy() {
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
//# sourceMappingURL=EditorView.js.map