import { Group, Mesh, Scene, WebGLRenderer } from "three";
import { OrbitCamera } from "./Camera";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { log } from "../../../../../shared/utils/logger";
import { RenderSystem } from "../../RenderSystem";
import { TextureBuilder } from "./TextureBuilder";
export class ThreeRenderer extends RenderSystem {
    constructor(view) {
        super(view);
        this.scene = new Scene();
        this.camera = new OrbitCamera();
        this.textureBuilder = new TextureBuilder();
        this.camera.connect();
        this.world = new Group();
        this.gltf = new GLTFLoader();
        this.scene.add(this.world);
    }
    async init(settings) {
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
    runInternalRenderer() {
        this.camera.update();
        this.three.render(this.scene, this.camera);
    }
    async loadAsset(src) {
        const gltf = await this.gltf.loadAsync(src);
        return gltf.scene;
    }
    disposeAsset(asset) {
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
    resize(width, height = width) {
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
    destroy(view) {
        this.camera.destroy();
        this.three.dispose();
        this.three.forceContextLoss();
        super.destroy(view);
    }
}
