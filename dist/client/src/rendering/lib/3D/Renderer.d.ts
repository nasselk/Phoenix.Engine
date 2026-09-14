import { Group, Scene, WebGLRenderer, type Object3D } from "three";
import { OrbitCamera } from "./Camera";
import { RenderSystem } from "../../RenderSystem";
import { TextureBuilder } from "./TextureBuilder";
type RendererSettings = Partial<{
    resolution: number;
    backgroundColor: number;
    antialiasing: boolean;
    fullscreen: boolean;
}>;
export declare class ThreeRenderer extends RenderSystem<Object3D> {
    private three;
    private readonly gltf;
    scene: Scene;
    world: Group;
    readonly camera: OrbitCamera;
    readonly textureBuilder: TextureBuilder;
    constructor(view?: HTMLCanvasElement);
    init(settings: RendererSettings): Promise<WebGLRenderer>;
    protected runInternalRenderer(): void;
    protected loadAsset(src: string): Promise<Object3D>;
    protected disposeAsset(asset: Object3D): void;
    protected resize(width?: number, height?: number | undefined): this;
    destroy(view?: boolean): void;
}
export {};
