import type { SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions } from "../../shared/world/registry";
import { World, type WorldRoleless } from "./world/world";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import { PixiRenderer } from "./rendering/lib/2D/2D";
import { ThreeRenderer } from "./rendering/lib/3D/3D";
import { GameLoop } from "./GameLoop";
import { AudioSystem } from "./audio/AudioSystem";
import { InputSystem, type InputSystemOptions } from "./controls/InputSystem";
import { RendererKind } from "./rendering/RenderSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
export * from "../../shared/index";
export { Entity } from "./world/entity";
export { MovingEntity } from "./world/moving";
export { DEFAULT_SMOOTHING, FRAME, PositionEntity, SNAP_DISTANCE } from "./world/position";
export { RotationEntity, SNAP_ANGLE } from "./world/rotation";
export { World, type WorldRoleless } from "./world/world";
export { AudioSystem, type AudioOptions } from "./audio/AudioSystem";
export { InputSystem, type ActionCallback, type InputSystemOptions } from "./controls/InputSystem";
export { GameLoop } from "./GameLoop";
export { NetworkState, NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { RenderSystem, type RendererKind } from "./rendering/RenderSystem";
export { Camera } from "./rendering/lib/2D/camera";
export { PixiRenderer } from "./rendering/lib/2D/2D";
export { ThreeRenderer } from "./rendering/lib/3D/3D";
export { OrbitCamera, type OrbitCameraOptions, type OrbitTarget } from "./rendering/lib/3D/camera";
type EngineEvents = {
    init: [];
    destroy: [];
};
export declare const DEFAULT_CAPACITY = 5000;
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, Actions extends readonly string[] = [], R extends RendererKind = RendererKind, D extends EntityDefinitions = EntityDefinitions> = {
    readonly renderer: R;
    readonly world?: WorldRoleless<D>;
    readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
    readonly inputs?: InputSystemOptions<Actions>;
};
export declare class Engine<const In extends readonly string[] = [], const Out extends readonly string[] = [], InSchemas extends SchemasFor<InSchemas, In> = {}, OutSchemas extends SchemasFor<OutSchemas, Out> = {}, const Actions extends readonly string[] = [], R extends RendererKind = RendererKind, const D extends EntityDefinitions = EntityDefinitions> extends EventEmitter<EngineEvents> {
    readonly renderer: R extends "2D" ? PixiRenderer : ThreeRenderer;
    readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
    readonly loop: GameLoop;
    readonly audio: AudioSystem;
    readonly inputs: InputSystem<Actions>;
    readonly world: World<D>;
    constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, Actions, R, D>);
    init(...promises: Promise<void>[]): Promise<void>;
    destroy(): void;
}
