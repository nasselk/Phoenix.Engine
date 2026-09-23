// The whole isomorphic surface, so a game that only has a client imports from one place.
export * from "../../shared/index";
// The client's own object model, exported over the shared one: an entity that can read itself and
// a world that can apply a frame. `import { Entity } from "phoenix.engine/client"` is this one.
export { Entity } from "./world/entities/entity";
export { MovingEntity, type MovingEntityOptions } from "./world/entities/moving";
export { PositionEntity, type PositionEntityOptions } from "./world/entities/position";
export { World, type ClientWorldOptions } from "./world/world";
// Client-only pieces a game builds on: the render backends, the built-in render system, and the
// subsystems whose types appear in EngineOptions.
export { AssetCache, type AssetKind, type AssetKinds } from "./assets/AssetCache";
export { AssetManager, type AssetLoader, type AssetManagerOptions, type AssetManifest, type AssetSource, type AssetSources } from "./assets/AssetManager";
export { type SoundSource } from "./assets/loaders/sound";
export { AudioSystem, type AudioOptions } from "./audio/AudioSystem";
export { InputSystem, type ActionCallback, type InputSystemOptions } from "./controls/InputSystem";
export { GameLoop, type GameLoopParams, type LoopStats } from "./GameLoop";
export { NetworkState, NetworkSystem, type NetworkChannelStats, type NetworkStats, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { RenderSystem, RenderSystemState, type RenderSystemOptions as RendererSettings } from "./rendering/RenderSystem";
export { OrbitCamera, type OrbitCameraOptions, type OrbitTarget } from "./rendering/lib/camera/Camera";
export { DesktopCamera, type DesktopCameraOptions, type FlyKeys } from "./rendering/lib/camera/DesktopCamera";
export { TouchCamera, type TouchCameraOptions } from "./rendering/lib/camera/TouchCamera";
export { storage, setStorage } from "./utils/storage";
export { EditorView, type EditorViewOptions } from "./rendering/lib/editor/EditorView";
export { Engine, type EngineOptions } from "./engine";
export { isMobileDevice, type DeviceType } from "./utils/mobile";
