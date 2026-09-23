import { credit, log } from "../../shared/utils/logger";
import { World } from "./world/world";
import { NetworkSystem } from "./networking/NetworkSystem";
import { RenderSystem } from "./rendering/RenderSystem";
import { GameLoop } from "./GameLoop";
import { AudioSystem } from "./audio/AudioSystem";
import { InputSystem } from "./controls/InputSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
import { AssetManager } from "./assets/AssetManager";
import { native } from "./native";
import { isMobileDevice } from "./utils/mobile";
export class Engine extends EventEmitter {
    constructor(options) {
        super();
        const world = options.world;
        if (options.native !== false) {
            this.ordinary = native(options.native === true ? undefined : options.native);
        }
        this.isMobile = isMobileDevice().any;
        this.rendering = options.renderer ?? {};
        this.sound = options.audio ?? {};
        this.loop = new GameLoop(options.loop);
        this.renderer = new RenderSystem(undefined, this.isMobile);
        this.assets = new AssetManager(options.assets);
        this.network = new NetworkSystem(options.network);
        this.inputs = new InputSystem(options.inputs);
        this.audio = new AudioSystem(this.assets);
        this.world = new World({ ...world, context: (world.context ?? this) });
        this.renderer.scene.add(this.world.group);
    }
    async init(...promises) {
        credit("Client");
        log("Phoenix Client", "Initializing the engine...");
        const renderer = this.renderer
            .init({
            backgroundColor: 0x000000,
            resolution: 1,
            ...this.rendering,
            three: { antialias: true, ...this.rendering.three },
        })
            .then((three) => this.assets.init(three));
        const audio = this.audio.init(this.sound);
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
        this.network.destroy();
        this.inputs.destroy();
        this.loop.destroy();
        this.world.destroy();
        this.audio.destroy();
        this.assets.destroy();
        this.renderer.destroy();
        this.ordinary?.();
        this.emit("destroy");
        this.removeAllListeners();
    }
}
