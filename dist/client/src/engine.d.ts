import type { SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions } from "../../shared/world/registry";
import { type ClientWorldOptions, World } from "./world/world";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import { RenderSystem, type RenderSystemOptions } from "./rendering/RenderSystem";
import { GameLoop, type GameLoopParams } from "./GameLoop";
import { AudioSystem, type AudioOptions } from "./audio/AudioSystem";
import { InputSystem, type InputSystemOptions } from "./controls/InputSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
import { AssetManager, type AssetManagerOptions } from "./assets/AssetManager";
import { type NativeOptions } from "./native";
type EngineEvents = {
    init: [];
    destroy: [];
};
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, Action extends string = never, D extends EntityDefinitions = EntityDefinitions, C = never> = {
    readonly world: ClientWorldOptions<D, C>;
    readonly loop?: Partial<GameLoopParams>;
    readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
    readonly inputs?: InputSystemOptions<Action>;
    readonly assets?: AssetManagerOptions;
    readonly renderer?: RenderSystemOptions;
    readonly audio?: Partial<AudioOptions>;
    readonly native?: boolean | NativeOptions;
};
type ContextOf<C, Self> = [C] extends [never] ? Self : C;
export declare class Engine<const In extends readonly string[] = [], const Out extends readonly string[] = [], InSchemas extends SchemasFor<InSchemas, In> = {}, OutSchemas extends SchemasFor<OutSchemas, Out> = {}, const Action extends string = never, const D extends EntityDefinitions = EntityDefinitions, C = never> extends EventEmitter<EngineEvents> {
    readonly renderer: RenderSystem;
    readonly assets: AssetManager;
    readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
    readonly loop: GameLoop;
    readonly audio: AudioSystem;
    readonly inputs: InputSystem<Action>;
    readonly world: World<D, ContextOf<C, this>>;
    readonly isMobile: boolean;
    private readonly rendering;
    private readonly sound;
    private readonly ordinary?;
    constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, Action, D, C>);
    init(...promises: Promise<void>[]): Promise<void>;
    destroy(): void;
}
export {};
