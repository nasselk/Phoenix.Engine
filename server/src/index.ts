// The whole isomorphic surface, so a game that only has a server imports from one place.
export * from "../../shared/index";
// The server's own object model, exported over the shared one: an entity that can write itself and
// a world that can write a frame. `import { Entity } from "phoenix.engine/server"` is this one.
export { Entity } from "./world/entities/entity";
export { MovingEntity, type MovingEntityOptions } from "./world/entities/moving";
export { POSITION_EPSILON, PositionEntity, ROTATION_EPSILON, type PositionEntityOptions } from "./world/entities/position";
export { World, type ServerWorldOptions } from "./world/world";
export { RAPIER, eulerToQuaternion, initPhysics, quaternionToEuler } from "../../shared/physics/rapier";
// Server-only pieces a game builds on.
export { GameLoop, type GameLoopParams, type LoopStats } from "./GameLoop";
export { DEFAULT_NETWORK_SETTINGS, NetworkSystem, type EventLimit, type EventLimits, type NetworkSettings, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { Socket, SocketState, type SocketData } from "./networking/socket";
export { setExitListeners } from "./utils/utils";
export { Engine, MAX_INVITE_CODE_ATTEMPTS, type EngineOptions } from "./engine";
