import Stats from "stats.js";
import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Matrix4, Quaternion, Vector3 } from "three";
import { normalizeAnglePI } from "../../../../../shared/math/angle";
import { clamp } from "../../../../../shared/math/utils";
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
const FRUSTUM_CORNERS = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
];
const GIZMO_ORBIT_SPEED = 0.012;
const WORLD_UP = new Vector3(0, 1, 0);
const UNIT_SCALE = new Vector3(1, 1, 1);
const LOOK = new Matrix4();
const PIVOT = new Vector3();
const BACK = new Vector3();
const TURN = new Quaternion();
export class EditorView extends Group {
    constructor(engine, { plane, grid, axes } = {}) {
        super();
        this.unsubscribers = [];
        this.wired = new Set();
        this.wireframe = false;
        this.flying = false;
        this.lastFrames = 0;
        this.lastSample = 0;
        this.snap = {
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
            if (this.flying) {
                this.steer();
                this.outline();
            }
            if (this.snap.active) {
                this.swing();
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
        }), this.context.inputs.onPressInput((event) => {
            switch (event.code) {
                case "KeyV":
                    this.toggleWireframe();
                    break;
            }
        }));
    }
    toggleCamera(attach = this.flying) {
        const { renderer } = this.context;
        const { camera } = this;
        this.flying = !attach;
        this.frustum.visible = !attach;
        if (attach) {
            camera.flyForward = camera.flyRight = camera.turn = camera.tilt = 0;
            camera.flyBoost = false;
            renderer.activeCamera = renderer.camera;
        }
        else {
            renderer.activeCamera = camera.startFrom(renderer.camera);
            this.outline();
        }
    }
    get isFlying() {
        return this.flying;
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
        const geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(16 * 3), 3));
        const frustum = new LineSegments(geometry, new LineBasicMaterial({ color: 0xffaa00 }));
        frustum.visible = false;
        frustum.frustumCulled = false;
        frustum.matrixAutoUpdate = false;
        frustum.matrixWorldAutoUpdate = false;
        return frustum;
    }
    outline() {
        const game = this.context.renderer.camera;
        const { frustum } = this;
        const position = frustum.geometry.getAttribute("position");
        const height = Math.tan((game.fov * Math.PI) / 360) * FRUSTUM_LENGTH;
        const width = height * game.aspect;
        for (let corner = 0; corner < 4; corner++) {
            const [x, y] = FRUSTUM_CORNERS[corner];
            const [nextX, nextY] = FRUSTUM_CORNERS[(corner + 1) % 4];
            position.setXYZ(corner * 4, 0, 0, 0);
            position.setXYZ(corner * 4 + 1, x * width, y * height, -FRUSTUM_LENGTH);
            position.setXYZ(corner * 4 + 2, x * width, y * height, -FRUSTUM_LENGTH);
            position.setXYZ(corner * 4 + 3, nextX * width, nextY * height, -FRUSTUM_LENGTH);
        }
        position.needsUpdate = true;
        frustum.matrixWorld.compose(game.position, game.quaternion, UNIT_SCALE);
    }
    viewFrom(axis) {
        const { snap } = this;
        const side = EDITOR_AXES[axis];
        snap.active = true;
        snap.start = performance.now();
        snap.free = this.flying;
        if (snap.free) {
            const { camera } = this;
            snap.pivot.copy(camera.getWorldDirection(PIVOT)).multiplyScalar(camera.distance).add(camera.position);
            snap.from.copy(camera.quaternion);
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
    orbit(x, y) {
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
    swing() {
        const { snap } = this;
        const progress = Math.min((performance.now() - snap.start) / (SNAP_DURATION * 1000), 1);
        const eased = progress * progress * (3 - 2 * progress);
        if (progress === 1) {
            snap.active = false;
        }
        if (snap.free !== this.flying) {
            snap.active = false;
            return;
        }
        if (snap.free) {
            this.camera.quaternion.slerpQuaternions(snap.from, snap.to, eased);
            this.around(snap.pivot);
        }
        else {
            const { camera } = this.context.renderer;
            camera.yaw = snap.fromYaw + (snap.toYaw - snap.fromYaw) * eased;
            camera.pitch = snap.fromPitch + (snap.toPitch - snap.fromPitch) * eased;
        }
    }
    around(pivot) {
        const { camera } = this;
        camera.position.copy(pivot).addScaledVector(BACK.set(0, 0, 1).applyQuaternion(camera.quaternion), camera.distance);
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
//# sourceMappingURL=EditorView.js.map