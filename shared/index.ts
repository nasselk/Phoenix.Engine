/**
 * The isomorphic surface of the engine: everything a game imports on both sides.
 *
 * `phoenix.engine/client` and `phoenix.engine/server` re-export all of this, so
 * game code that only ever runs on one side can import from one place. Code
 * shared between a game's own client and server imports from here.
 */

// The object model: what a game's own classes extend, and the world that ticks them.
// `Entity` and `World` are the halves both sides share; each side's entry point exports its own
// `Entity`, `PositionEntity`, `MovingEntity` and `World` over the top of these.
export {
	defineEntities,
	Entity,
	EntityRegistry,
	GRAVITY,
	MAX_ENTITIES,
	MAX_ENTITY_KINDS,
	Phase,
	World,
	type EntityClass,
	type EntityConstructor,
	type EntityDefinitions,
	type UpdateCallback,
	type UpdateOptions,
	type WorldEvents,
	type WorldOptions,
	type WorldRole,
} from "./world/index";

/**
 * The binary primitives, re-exported from the engine's own copy of them.
 *
 * Import them from here rather than from `@nasselk/binarypack` directly. A game installs its own
 * copy of that package, and two copies of a class are two classes — a writer built from the game's
 * would fail the `instanceof` check inside the engine's protocol and be encoded as no payload at
 * all. Anything that writes a frame the engine will send, or reads one it received, has to be
 * holding the engine's.
 */
export { BufferReader, BufferWriter, type Buffers } from "@nasselk/binarypack";

// Networking: the wire contract types both sides declare against
export { MAX_EVENTS, Protocol, ProtocolChannel, type Contract, type ContractOf, type InboundEvent, type InboundSchemas, type MessagePayload, type OutboundEvent, type OutboundSchemas, type SchemasFor, type SendPayload, type Side } from "./networking/protocol";
export { SESSION_ROUTE, SESSION_SUBPROTOCOL, SESSION_TTL, TICKET_TTL, WS_ROUTE, type SessionRequest, type SessionResponse } from "./networking/session";

// Utilities
export { CounterMap } from "./utils/CounterMap";
export { EventEmitter } from "./utils/EventEmitter";
export { IDAllocator } from "./utils/IDAllocator";
export { credit, error, log, warn } from "./utils/logger";
export { Interval, Timeout, Timer } from "./utils/timers/timer";
export { wait } from "./utils/timers/wait";

// Math
export { Interpolator } from "./libs/math/interpolation";
export { ObservableVector3, Vector3, type Vector3Structure } from "./libs/math/vector3D";
export { clamp, wrap } from "./libs/math/utils";
export { randomElement, randomFloat, randomInt } from "./libs/math/random";
