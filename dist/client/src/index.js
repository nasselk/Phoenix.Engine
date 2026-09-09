import { credit, log } from "../../shared/utils/logger";
import { World } from "./world/world";
import { NetworkSystem } from "./networking/NetworkSystem";
import { PixiRenderer } from "./rendering/lib/2D/2D";
import { ThreeRenderer } from "./rendering/lib/3D/3D";
import { GameLoop } from "./GameLoop";
import { AudioSystem } from "./audio/AudioSystem";
import { InputSystem } from "./controls/InputSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export * from "../../shared/index";
export { Entity } from "./world/entity";
export { MovingEntity } from "./world/moving";
export { DEFAULT_SMOOTHING, FRAME, PositionEntity, SNAP_DISTANCE } from "./world/position";
export { RotationEntity, SNAP_ANGLE } from "./world/rotation";
export { World } from "./world/world";
export { AudioSystem } from "./audio/AudioSystem";
export { InputSystem } from "./controls/InputSystem";
export { GameLoop } from "./GameLoop";
export { NetworkState, NetworkSystem } from "./networking/NetworkSystem";
export { RenderSystem } from "./rendering/RenderSystem";
export { Camera } from "./rendering/lib/2D/camera";
export { PixiRenderer } from "./rendering/lib/2D/2D";
export { ThreeRenderer } from "./rendering/lib/3D/3D";
export { OrbitCamera } from "./rendering/lib/3D/camera";
export const DEFAULT_CAPACITY = 5000;
export class Engine extends EventEmitter {
    constructor(options) {
        super();
        const world = options.world;
        this.renderer = new (options.renderer === "2D" ? PixiRenderer : ThreeRenderer)();
        this.network = new NetworkSystem(options.network);
        this.inputs = new InputSystem(options.inputs);
        this.loop = new GameLoop();
        this.audio = new AudioSystem();
        this.world = new World({ ...world, capacity: world?.capacity ?? DEFAULT_CAPACITY, role: world?.entities === undefined ? "local" : "mirror" });
    }
    async init(...promises) {
        credit("Client");
        log("Phoenix Client", "Initializing the engine...");
        const renderer = this.renderer.init({
            antialiasing: true,
            backgroundColor: 0x000000,
            resolution: 1,
        });
        const audio = this.audio.init();
        this.inputs.init();
        this.loop.on("frame", (deltaTime, now) => {
            this.world.update(deltaTime);
            this.renderer.render(deltaTime, now);
        });
        await Promise.all([renderer, audio, ...promises]);
        this.loop.resume();
        log("Phoenix Client", "Successfully initiated the engine");
        this.emit("init");
    }
    destroy() {
        this.network.disconnect();
        this.inputs.destroy();
        this.loop.destroy();
        this.world.dispose();
        this.audio.destroy();
        this.renderer.destroy();
        this.emit("destroy");
        this.removeAllListeners();
    }
}
