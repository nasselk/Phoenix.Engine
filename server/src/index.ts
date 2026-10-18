// The whole isomorphic surface, so a game that only has a server imports from one place.
export * from "../../shared/index";
export { initPhysics } from "../../shared/physics/rapier";
export { Engine, type EngineOptions, MAX_INVITE_CODE_ATTEMPTS, type RoomOptions } from "./engine";
// Server-only pieces a game builds on.
export { GameLoop, type GameLoopParams, type LoopStats } from "./GameLoop";
export { DEFAULT_NETWORK_SETTINGS, type EventLimit, type EventLimits, type NetworkSettings, NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { Socket, type SocketData, SocketState } from "./networking/socket";
export { setExitListeners } from "./utils/utils";
// The server's own object model, exported over the shared one: an entity that can write itself and
// a world that can write a frame. `import { Entity } from "phoenix.engine/server"` is this one.
export { Entity } from "./world/entities/entity";
export { MovingEntity, type MovingEntityOptions } from "./world/entities/moving";
export { POSITION_EPSILON, PositionEntity, type PositionEntityOptions, ROTATION_EPSILON } from "./world/entities/position";
export { type ServerWorldOptions, World } from "./world/world";
