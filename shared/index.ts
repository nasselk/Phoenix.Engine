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
	MAX_ENTITY_KINDS,
	World,
	type EntityClass,
	type EntityOptions,
	type EntityConstructor,
	type EntityDefinitions,
	type WorldEvents,
	type WorldOptions,
} from "./world/index";

// Physics: the integration and the collisions, the same on both sides, for a game that simulates on
// either. A collider attaches to anything with a position, so a client can run what the server ran.
export * from "./physics/index";

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
export { ServerRoutes, SESSION_SUBPROTOCOL, SESSION_TTL, TICKET_TTL, type SessionRequest, type SessionResponse } from "./networking/session";
export { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "./networking/invite";

// Utilities
export { CounterMap } from "./utils/CounterMap";
export { deepCopy, deepMerge, randomValue, removeFromArray } from "./utils/utils";
export type { DeepImmutable, JsonArray, JsonObject, JsonPrimitive, JsonValue } from "./utils/types";
export { EventEmitter } from "./utils/EventEmitter";
export { IDAllocator } from "./utils/IDAllocator";
export { credit, error, log, warn } from "./utils/logger";
export { Interval, Timeout, Timer } from "./utils/timers/timer";
export { createTimings, MAX_SAMPLES, PerfSampler, toRate, type Timings } from "./utils/perfStats";
export { wait } from "./utils/timers/wait";

// Math
export { Interpolator } from "./math/interpolation";
export { ObservableVector2, Vector2, type Vector2Structure } from "./math/vector2";
export { ObservableVector3, Vector3, type Vector3Structure } from "./math/vector3";
export { clamp, wrap } from "./math/utils";
export { censorText, normalizeText, validateText } from "./utils/validation/text";
export { randomElement, randomFloat, randomInt, randomAngle, randomBoolean, weightedRandom } from "./math/random";
