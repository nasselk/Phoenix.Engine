// The whole isomorphic surface, so a game that only has a client imports from one place.
export * from "../../shared/index";
// Client-only pieces a game builds on: the render backends, the built-in render system, and the
// subsystems whose types appear in EngineOptions.
export { AssetCache, type AssetKind, type AssetKinds } from "./assets/AssetCache";
export { type AssetLoader, AssetManager, type AssetManagerOptions, type AssetManifest, type AssetSource, type AssetSources } from "./assets/AssetManager";
export type { SoundSource } from "./assets/loaders/sound";
export { type AudioOptions, AudioSystem } from "./audio/AudioSystem";
export { encodeWav, type PCMSource, SoundBuilder, type SoundLayer } from "./audio/lib/SoundBuilder";
export { type ActionCallback, InputSystem, type InputSystemOptions } from "./controls/InputSystem";
export { Engine, type EngineOptions } from "./engine";
export { GameLoop, type GameLoopParams, type LoopStats } from "./GameLoop";
export { type NetworkChannelStats, NetworkState, type NetworkStats, NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { Camera, type CameraOptions, type CameraTarget } from "./rendering/Camera";
export { type EditorAxis, EditorView, type EditorViewOptions } from "./rendering/lib/editor/EditorView";
export { RenderSystem, type RenderSystemOptions, RenderSystemState } from "./rendering/RenderSystem";
export { type DeviceType, isMobileDevice } from "./utils/mobile";
export { setStorage, storage } from "./utils/storage";
// The client's own object model, exported over the shared one: an entity that can read itself and
// a world that can apply a frame. `import { Entity } from "phoenix.engine/client"` is this one.
export { Entity } from "./world/entities/entity";
export { MovingEntity, type MovingEntityOptions } from "./world/entities/moving";
export { PositionEntity, type PositionEntityOptions } from "./world/entities/position";
export { type ClientWorldOptions, World } from "./world/world";
