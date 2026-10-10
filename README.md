# Phoenix Engine

A TypeScript engine for **server-authoritative, real-time multiplayer 3D games on the web**. It is a library, not an application: a game installs it, builds its own client and server on top, and the engine supplies the machinery in between — rooms, physics, replication, a typed binary protocol, rendering, input, audio and assets.

The fastest way to start a game is the [Phoenix Engine Template](https://github.com/nasselk/Phoenix.Engine-Template), which is a complete, playable game wired to this engine. Rules for AI agents are in [AGENTS.md](./AGENTS.md). The **[API map](./API.md)** lists every public class, member and helper, nested under where a game reaches it (`engine.renderer.textureBuilder`, `engine.audio.soundBuilder`…). Check it before writing a helper the engine may already have.

## Table of contents

- [At a glance](#at-a-glance)
- [Entry points](#entry-points)
- [Installation](#installation)
- [Quick start](#quick-start)
  - [Server](#server)
  - [Client](#client)
- [How it works](#how-it-works)
  - [The big picture](#the-big-picture)
  - [Engine](#engine)
  - [Rooms and worlds](#rooms-and-worlds)
  - [Entities](#entities)
  - [The entity registry](#the-entity-registry)
  - [The tick](#the-tick)
  - [Physics](#physics)
  - [Replication](#replication)
  - [The protocol](#the-protocol)
  - [Client systems](#client-systems)
  - [UI kit and native feel](#ui-kit-and-native-feel)
  - [Shared utilities](#shared-utilities)
- [Common tasks](#common-tasks)
- [Design principles](#design-principles)
- [Development](#development)
  - [Commands](#commands)
  - [Tests](#tests)
  - [Releasing a change](#releasing-a-change)
  - [Pitfalls](#pitfalls)
- [License](#license)

## At a glance

| | |
| --- | --- |
| **Model** | The server simulates, clients mirror. One `World` per room on the server, one `World` per client that applies the server's frames. |
| **Game objects** | Plain classes: `Entity` → `PositionEntity` → `MovingEntity`, one class per side for each kind. No ECS. |
| **Physics** | [Rapier](https://rapier.rs/) 3D. Every room owns a physics world, stepped once a tick; bodies at rest fall asleep and cost nothing on the wire. |
| **Replication** | Per-socket interest management. Each entity is encoded once per tick, whatever the number of sockets that need it. A still room sends nothing. |
| **Protocol** | Event lists and [BinarySchema](https://github.com/nasselk/BinarySchema) payloads declared once, shared by both sides, typing `send` and `onMessage` end to end. |
| **Rendering** | [three.js](https://threejs.org/) with an orbit camera for desktop (mouse) and touch (drag, pinch). |
| **Server runtime** | [Bun](https://bun.sh/), WebSockets through `Bun.serve`, rate and size limits per event. |
| **Client runtime** | Any modern browser, bundled by the game (the template uses [Vite](https://vite.dev/)). |

## Entry points

One package, several subpath exports. Each side's entry point re-exports everything shared, so a file imports from exactly one place.

| Import | Runs on | Contains |
| --- | --- | --- |
| `phoenix.engine` | both | The shared surface: `defineEntities`, math (`Vector3`, `Quaternion`, their observable versions, `Interpolator`, `clamp`, `wrap`, random helpers), binary `BufferReader`/`BufferWriter`, protocol types, `INVITE_CODE_*` and `RoomOccupancy`, timers, `EventEmitter`, logger, text validation, HTTP helpers (`get`, `post`, `put`, `del`). For code a game shares between its client and server. |
| `phoenix.engine/server` | Bun | Everything shared, plus the server `Engine`, `World` (a room), `Entity`/`PositionEntity`/`MovingEntity` that **write** themselves, `NetworkSystem`, `Socket`, `GameLoop`, `initPhysics`, `setExitListeners`. |
| `phoenix.engine/client` | browser | Everything shared, plus the client `Engine`, `World` (a mirror), `Entity`/`PositionEntity`/`MovingEntity` that **read** themselves, `RenderSystem`, cameras, `InputSystem`, `AudioSystem`, `AssetManager`, `NetworkSystem`, `EditorView`, `storage`, `isMobileDevice`. |
| `phoenix.engine/text` | browser | `Text`: crisp signed-distance-field text in the scene, optionally facing the camera; `preloadFont`, `fontLoader`, `configureText`. Separate so a game that draws no text bundles none. |
| `phoenix.engine/native.css` | browser | Default styles that make the page behave like an app (no selection, no overscroll, no tap highlight). |
| `phoenix.engine/ui/<Name>.svelte` | browser | Svelte 5 components: `Joystick`, `GridLayout`. |

The game imports Rapier, three.js and Svelte from their own packages; the engine re-exports none of them. `@nasselk/binaryschema` is a peer too: the game installs it and writes its event schemas with it, and the engine only calls the schemas it is handed. `@nasselk/binarypack` is the other way round: the engine creates and checks buffers itself, so it is the engine's own dependency, re-exported from `phoenix.engine`. A game never installs it and imports `BufferReader`/`BufferWriter` from `phoenix.engine`.

## Installation

The engine is installed from GitHub, with its peer dependencies installed by the game next to it:

```sh
bun add github:nasselk/Phoenix.Engine
bun add @dimforge/rapier3d-simd-compat   # server: physics
bun add github:nasselk/BinarySchema      # both: event payload schemas
bun add three svelte                     # client: rendering and UI
```

| Peer dependency | Version | Needed by |
| --- | --- | --- |
| `@dimforge/rapier3d-simd-compat` | `^0.21.0` | the server, and a client that simulates physics |
| `three` | `^0.186.0` | the client (optional peer) |
| `svelte` | `^5.57.1` | the client, when using the UI kit (optional peer) |
| `@nasselk/binaryschema` | `github:nasselk/BinarySchema` | both sides: the game's event schemas, and the payload types of `send`/`onMessage` |

Rapier is the SIMD build (faster collision detection and solving; every modern browser, Bun and Node support WebAssembly SIMD) in its *compat* form (the WebAssembly is embedded in the JavaScript and loaded by `initPhysics()`, so it works in Bun and in any bundler without plugins). They are peers so that the engine and the game share **one copy** of each. With Rapier this is not a nicety: two copies means two WebAssembly instances, one of which is never initialised, and objects from one cannot be used in the other. Import Rapier, three.js and Svelte **directly from their own packages** in game code; the engine does not re-export them.

## Quick start

A bouncing ball, simulated on the server and drawn on every connected client.

### Server

```ts
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-simd-compat";
import { defineEntities, Engine, MovingEntity, type MovingEntityOptions, type World } from "phoenix.engine/server";

class Ball extends MovingEntity<unknown> {
	public constructor(world: World<any, unknown>, context: unknown, options: MovingEntityOptions = {}) {
		super(world, context, { y: 5, ...options });

		// The physics owns its motion from here on: gravity, bounces, being pushed.
		this.embody(RigidBodyDesc.dynamic(), ColliderDesc.ball(0.5).setRestitution(0.8));
	}
}

class Ground extends MovingEntity<unknown> {
	public constructor(world: World<any, unknown>, context: unknown, options: MovingEntityOptions = {}) {
		super(world, context, { y: -0.5, ...options });

		this.embody(RigidBodyDesc.fixed(), ColliderDesc.cuboid(50, 0.5, 50));
	}
}

const engine = new Engine({
	entities: defineEntities({ ball: Ball, ground: Ground }),
	network: {
		in: { events: [] as const },
		out: { events: ["sync"] as const },
		port: 3000,
	},
});

await engine.init(); // loads Rapier, opens the port, starts ticking

const room = engine.createRoom();

room.spawn("ground");
room.spawn("ball", { x: 0 });

engine.network.on("connection", (socket) => room.join(socket));
engine.network.on("disconnection", (socket) => room.leave(socket));

// After every tick: each socket gets what it has not seen yet, then the changes count as sent.
room.on("update", () => {
	for (const socket of room.sockets) {
		const frame = room.frame(socket, room.entities.values());

		if (frame !== undefined) {
			socket.send("sync", frame);
		}
	}

	room.clean();
});
```

### Client

```ts
import { defineEntities, Engine, PositionEntity, type PositionEntityOptions, type World } from "phoenix.engine/client";
import { BoxGeometry, Mesh, MeshNormalMaterial, SphereGeometry } from "three";

class Ball extends PositionEntity<unknown> {
	public constructor(world: World<any, unknown>, context: unknown, options: PositionEntityOptions = {}) {
		super(world, context, options);

		this.group.add(new Mesh(new SphereGeometry(0.5), new MeshNormalMaterial()));
	}

	public render(): void {}
}

class Ground extends PositionEntity<unknown> {
	public constructor(world: World<any, unknown>, context: unknown, options: PositionEntityOptions = {}) {
		super(world, context, options);

		this.group.add(new Mesh(new BoxGeometry(100, 1, 100), new MeshNormalMaterial()));
	}

	public render(): void {}
}

const engine = new Engine({
	// Same kind names as the server, mapped onto the classes that draw them here.
	world: { entities: defineEntities({ ball: Ball, ground: Ground }) },
	network: {
		in: { events: ["sync"] as const },
		out: { events: [] as const },
	},
});

document.body.appendChild(engine.renderer.view);

await engine.init();

engine.renderer.camera.position.set(0, 6, 12);
engine.renderer.camera.lookAt(0, 0, 0);

// The whole of the netcode: a frame in, a world updated, each entity reading its own bytes.
engine.network.onMessage("sync", (reader) => engine.world.sync(reader));

await engine.network.connect("http://localhost:3000");
```

## How it works

### The big picture

```
                 SERVER (Bun)                                       CLIENT (browser)
 ┌──────────────────────────────────────────┐          ┌──────────────────────────────────────┐
 │ Engine                                   │          │ Engine                               │
 │  ├─ GameLoop ── tick ──┐                 │          │  ├─ GameLoop ── frame ──┐            │
 │  ├─ NetworkSystem      │                 │          │  ├─ NetworkSystem       │            │
 │  └─ rooms ─────────────┤                 │          │  ├─ InputSystem         │            │
 │       World (room)  ◄──┘                 │          │  ├─ RenderSystem ◄──────┤            │
 │        ├─ entities (write themselves)    │  frames  │  ├─ AudioSystem         │            │
 │        ├─ physics (Rapier world)         │ ───────► │  ├─ AssetManager        │            │
 │        ├─ sockets                        │          │  └─ World (mirror) ◄────┘            │
 │        └─ replication                    │ ◄─────── │       └─ entities (read themselves)  │
 │                                          │  events  │                                      │
 └──────────────────────────────────────────┘          └──────────────────────────────────────┘
                         ▲                                              ▲
                         └──────── shared: kind names, event lists, payload schemas ──┘
```

The server is the authority. It runs the rules and the physics, and tells each client what it can see. A client never decides anything about the world: it sends intentions (keys, camera, chat), receives frames, and draws.

### Engine

There is one `Engine` per process on each side, and it owns every subsystem.

**Server** — `new Engine(options)`:

| Option | |
| --- | --- |
| `entities` | The registry from `defineEntities`: the kinds every room can spawn. |
| `context` | Handed to every entity as `this.context`. Defaults to the engine; a game passes itself. |
| `network` | `in`/`out` event lists and schemas, `limits` per event, `port`, `origins`, `TLS`, `proxied`, and `ws`/`http` transport limits. |
| `loop` | `TPS` (ticks per second), `turbo`, `speed`. Every tick is exactly `1 / TPS` seconds (times `speed`): a server that falls behind runs several in a row to catch up, up to a tenth of a second's worth, and drops the rest. So each step of the physics is the same, and a client predicting its own player can run the same steps. |
| `rooms` | `maximum` rooms per process: `createRoom` throws past it. |

`await engine.init()` loads Rapier, opens the network and starts the loop.

| Rooms | |
| --- | --- |
| `createRoom({ maxPlayers?, capacity?, public = true, inviteCode? })` | Opens a room. `maxPlayers` is how many sockets can join it (defaults to its capacity); `capacity` how many entities it holds at once (default 65535); a room that is not `public` is left out of `fullestRoom`; the invite code defaults to a free random one of `INVITE_CODE_LENGTH` characters from `INVITE_CODE_ALPHABET`. |
| `fullestRoom(...exclude)` | The public room with the most players that still has a free seat, skipping the invite codes given. For quick play. |
| `getRoom(code)`, `destroyRoom(code)`, `rooms` | Look up, close, and every open room by code. |
| `occupancy()` | `{ [code]: { players, maxPlayers, public } }` for every open room, for the server's own use: it lists private rooms' codes, so it is never served. |

Besides WebSockets (`GET /ws`), the server answers HTTP: `GET /infos` (`{ players, maxPlayers, uptime }` for the whole server), `GET /ping`, `GET /rooms/:code` (that room's `{ players, maxPlayers, public }`, or 404, so a client can find which server has a room without any server listing its codes), and any GET route a game adds with `engine.network.route(path, (request) => Response)` before `init` (path parameters are in `request.params`). All of them get the network's CORS and rate limits, and so does the WebSocket upgrade: a socket opens only from an allowed origin, within the request rate.

A room is safe to destroy from inside its own tick, with `engine.destroyRoom(code)` or `room.destroy()`: the tick finishes without running anything else of it, its physics is freed afterwards, and the engine drops it. A spawn into a full room throws before the entity is built, so it leaves no body behind.

**Client** — `new Engine(options)`:

| Option | |
| --- | --- |
| `world` | `{ entities, context }`: the same kind names as the server, mapped onto the classes that draw them. |
| `network` | `in`/`out` event lists and schemas: the mirror of the server's declaration. `simulation: { latency, loss }` starts with simulated lag (ms) and loss (0 to 1), for testing under bad conditions. |
| `assets` | `path` (base URL for every asset), `draco` and `ktx2` (decoder folders, for compressed models and textures), `meshopt`, `crossOrigin`, `headers`. |
| `inputs` | `{ binds }`: every action and its default keys. The keys of this object are the only action names the input API accepts. |
| `loop` | `FPS` cap (`Infinity` for the display's rate), `speed`. |
| `renderer` | Resolution, background, fullscreen, WebGL/WebGPU, `shadows` (a three.js shadow map type such as `PCFShadowMap`; unset, no shadows), `toneMapping` (such as `NeutralToneMapping`) and `exposure`, and three.js renderer parameters. |
| `audio` | `globalVolume` (0 to 1) and `muteInitial`. |
| `native` | App-like page behaviour (no context menu, no pinch zoom). On by default. |

`await engine.init()` builds the renderer, the audio context and the inputs, then starts the loop. `engine.isMobile` says which camera controls were chosen.

### Rooms and worlds

A `World` holds entities, hands out ids and ticks them. Both sides share its query API:

```ts
room.get(id);                 // any entity
room.get(id, Player);         // only if it is a Player
room.each(Crate, (crate) => …);
room.all("player");           // by kind name, typed from the registry
room.count(Player);
room.clear("crate");
room.on("spawn" | "destroy" | "beforeUpdate" | "update", …);
```

On the **server**, a world is a **room**: it also has an `inviteCode`, `maxPlayers`, `public`, the `sockets` that joined it, a Rapier `physics` world, and `spawn`, `join`, `leave`, `frame`, `clean` and `broadcast`. `room.join(socket)` returns `false` when the socket is already in it or it is full, and takes the socket out of any other room first. `socket.room` says which room a socket is in; `socket.data` is the game's own per-socket data, typed by augmenting `SocketData`:

```ts
declare module "phoenix.engine/server" {
	interface SocketData {
		player?: Player;
	}
}
```

On the **client**, a world is a **mirror**: `sync(reader)` applies a frame. Replicated entities carry the server's (positive) ids; entities the client spawns itself with `engine.world.spawn(kind, options)` (effects, previews, decorations) get negative ids, so the two never collide and local ones never go on the wire. The world's `group` is in the scene already, and every entity's `group` goes in it.

### Entities

Every game object is a class. Each side has its own chain, and they differ in exactly the half of the wire they handle:

| | Server (`phoenix.engine/server`) | Client (`phoenix.engine/client`) |
| --- | --- | --- |
| `Entity` | `update(dt)`, `serialize(writer)`, `serializeUpdate(writer)`, `isDirty`, `clean()` | `update(dt)`, `deserialize(reader)`, `deserializeUpdate(reader)`, and `render(dt)`: a hook for the game to refresh visuals (after a size change, say); the engine never calls it |
| `PositionEntity` | `position` (an `ObservableVector3`), `rotation` (an `ObservableQuaternion`), `yaw` (get and set), a Rapier `body`, `embody(desc, ...shapes)`, `beforePhysics()`/`afterPhysics()` | `position` and `rotation` (a `Quaternion`) brought to `targetPosition`/`targetRotation` by `updatePosition`/`updateRotation`, `yaw`, a three.js `group` placed there every frame |
| `MovingEntity` | Options for a starting `velocity`, `gravityScale`, `damping`, each set on the body only when given; `applyImpulse` | — |

A **box, a crate, a player are the game's classes**, written once per side, extending these. Behaviour goes in the entity's own `update`. Lifecycle hooks are `onSpawn` and `onDestroy`; `destroy()` removes an entity.

- **Reserved names**: the base classes own `id`, `kind`, `type`, `alive`, `spawnTime`, `age`, `world`, `context`, `slot` (server), `position`, `rotation`, `body`, `group`, `targetPosition`, `targetRotation`. A subclass field with one of these names silently breaks the engine's own; call a game's own "kind of crate" `variant`, not `kind`.
- **Interpolation on the client** is the game's: each frame `updatePosition(dt)` and `updateRotation(dt)` bring the shown `position`/`rotation` to the server's `targetPosition`/`targetRotation`, then `group` is placed there. By default they jump; override either one, without calling `super`, to ease or interpolate, per entity class. `this.world.serverTime` is the server time of the frame being read in `deserialize`/`deserializeUpdate`, for buffering samples. `teleport(x, y, z)` sets both position and target.
- **Acting on a specific entity** (grab, buy, hit): the client sends that entity's `id`, and the server checks it with `room.get(id, Kind)`. If each side picks "the nearest" on its own, they can pick different ones.

### The entity registry

```ts
// server                                        // client
defineEntities({ player: Player, crate: Crate }); defineEntities({ player: PlayerView, crate: CrateView });
```

A **name** is what the two sides agree on — never a class. A kind's wire code is its place in the sorted list of names, so both sides must declare the same names. The registry is also what types `room.spawn("player", options)`: the options are the class's own constructor options.

### The tick

Every server tick, for every room, in this order:

1. the room's `"beforeUpdate"` event, then every entity's `update(dt)` — game rules, input turned into velocity;
2. the physics step: `beforePhysics()` on every body (code-driven rotation goes in), `physics.step()`, then `afterPhysics()` (Rapier's positions come back out), then `onTouch`/`onTouchEnd` for every touch that started or ended;
3. the room's `"update"` event — where a game sends its frames, then calls `room.clean()`.

So what goes out in a frame is always the state *after* contact. The client runs the same shape every display frame: `world.update(dt)` (`"beforeUpdate"` listeners, then every entity's `update`: `updatePosition`/`updateRotation` bring what is shown to what the server sent, as the game decides, and its `group` follows), then the renderer's `"render"` event (the place for code that must see this frame's positions), then `camera.update(dt)` (the camera follows its target), then the draw.

### Physics

Each room owns a Rapier world with gravity `GRAVITY` (−9.81). An entity joins it by calling `embody` in its constructor:

```ts
this.embody(RigidBodyDesc.dynamic(), ColliderDesc.cuboid(0.5, 0.5, 0.5).setFriction(0.6));
```

- **Rapier owns the motion.** Velocity, mass and gravity live on `entity.body`; read and change them there. Pass `wakeUp: true` when changing a sleeping body (`setLinvel(v, true)`), or the change is ignored.
- **Body types**: `dynamic` (moved by forces and contacts), `fixed` (floors, walls), `kinematicPositionBased`/`kinematicVelocityBased` (moved by code, pushes others, is never pushed).
- **Mass** comes from the colliders: `density × volume`, or `ColliderDesc.setMass(m)`.
- **Rotation** is a quaternion, `entity.rotation`, copied to and from Rapier's as it is. A body with all rotations locked (`lockRotations()`) is turned by code: set `entity.yaw` (a turn about the vertical axis, standing it upright) or `entity.rotation.setFromEuler(pitch, yaw, roll)`, and it goes into the body before each step. Otherwise the physics turns it, and its rotation comes back out after. Spawn options take `pitch`, `yaw`, `roll` in radians, applied yaw, then pitch, then roll.
- **`body.userData`** is the entity, so a raycast or contact can find what it hit: `hit.collider.parent()?.userData`.
- **Sleeping**: a body at rest sleeps; its position stops changing, so it drops out of every frame.
- **Touches**: override `onTouch(other)` and `onTouchEnd(other)` on a server entity and it hears every other entity it starts or stops touching, after the step, once per pair of entities however many colliders touch. A collider with `setSensor(true)` is a zone things pass through: a kill brick, a checkpoint, a coin. Only entities that override one of the two make their colliders report, so resting crates cost nothing; the entity they touch hears of it too, through its own hooks. Destroying either side ends the touch on the other. Two fixed bodies never touch: one of the two must move.

```ts
class Coin extends PositionEntity<Game> {
	public constructor(world: World<any, Game>, context: Game, options: PositionEntityOptions) {
		super(world, context, options);
		this.embody(RigidBodyDesc.fixed(), ColliderDesc.ball(0.4).setSensor(true));
	}

	public override onTouch(other: PositionEntity<any>): void {
		if (other instanceof Player) {
			other.coins++;
			this.destroy();
		}
	}
}
```

### Replication

`room.frame(socket, visible)` builds one socket's frame from what it last received to `visible`:

```
[u8 event] [u16 despawns][id]…  [u16 spawns][kind u8][id u16][serialize]…  [u16 updates][id u16][serializeUpdate]…
```

- **What a socket sees is the game's call**: all entities, a chunk, a view cone. What leaves `visible` despawns; what enters it spawns. For "everything within a radius", a `SpatialGrid` answers without scanning the room:

  ```ts
  const grid = new SpatialGrid<PositionEntity<any>>(32);
  const visible: PositionEntity<any>[] = [];

  room.on("spawn", (entity) => entity instanceof PositionEntity && grid.insert(entity));
  room.on("destroy", (entity) => grid.remove(entity as PositionEntity<any>));
  room.on("update", () => {
  	for (const entity of room.bodies) grid.update(entity);   // whatever can move; here, the physics bodies
  	for (const socket of room.sockets) {
  		const frame = room.frame(socket, grid.query(socket.data.player!.position, 60, visible));
  		if (frame !== undefined) socket.send("sync", frame);
  	}
  	room.clean();
  });
  ```
- **Each entity is encoded once per tick** into a shared buffer; every socket's frame copies those bytes.
- **Records carry no length**: each entity reads exactly what its server side wrote. `serialize`/`deserialize` must write and read the same fields in the same order, `super` first.
- **`PositionEntity`'s part**: a spawn writes the position (3 × `Float32`) and the rotation packed into a `Uint32` ("smallest three": the largest component dropped, the other three at 10 bits each, within 0.25°). An update writes 4 flags (x, y, z, rotation), then only what changed: a position axis past `POSITION_EPSILON`, the rotation once it turned more than `ROTATION_EPSILON` radians.
- **A still room sends nothing**: an entity is only in the updates while `isDirty`; `frame` returns `undefined` when there is nothing to say.
- **`room.clean()` counts the changes as sent** — call it once every socket had its frame this tick.

Adding a field to a kind changes no protocol and no schema, only that kind's two classes. A field set once at spawn is a line in `serialize` and its mirror in `deserialize`. A field that changes later also needs `serializeUpdate`/`deserializeUpdate`, and the server class must report it in `isDirty` and reset it in `clean()`, or the change never leaves the server (an `ObservableVector3`'s `hasUpdated`/`store` does this for vectors; for a number, keep the last sent value next to it).

### The protocol

Each side declares the events it receives (`in`) and sends (`out`), and optionally a schema per event:

```ts
import { defineSchemas, FieldType } from "@nasselk/binaryschema";

export const CLIENT_EVENTS = ["join", "chat"] as const;

export const clientSchemas = defineSchemas({
	join: { fields: { code: { type: FieldType.String } } },
	chat: { fields: { text: { type: FieldType.String } } },
});

// client: engine.network.send("chat", { text: "hi" });
// server: network.onMessage("chat", (socket, { text }) => …);
```

An event's code is its index in its list, so both sides must use the same lists — keep them in a folder both import. A direction holds up to 255 events: code 255 is the engine's own ping, which the server answers at once and which sets `engine.network.stats.latency` every second without any game event. An event without a schema carries raw bytes (the `sync` frame) or nothing. The server enforces `limits` per event (`maxRate`, `byteLength`) and closes connections that break them. After a dropped connection the client reconnects by itself, as a new socket that is in no room: the game seats it again. The client world is **not** cleared on its own: on `engine.network.on("reconnection")`, call `engine.world.clear()` before the game rejoins its room, or entities despawned while the connection was down stay on screen forever.

`onMessage` takes one handler per event, since a raw reader can only be read once: registering a second throws. It returns a function that removes the handler. To watch all traffic, listen on `network.on("message")`.

Socket API: `socket.send(event, data)`, `socket.cork(fn)` (batch), `socket.disconnect(reason?, code?)` (with a close frame), `socket.terminate()` (at once), `socket.subscribe(topic)`/`unsubscribe(topic)`, `room.broadcast(event, data)`, `network.broadcast(topic, event, data)`.

### Client systems

| System | |
| --- | --- |
| `engine.renderer` | three.js `scene`, `camera` (an `OrbitCamera`: `target`, `yaw`/`pitch`, `detached` (true flies free, false snaps back to orbiting), zoom), `view` (the canvas to mount), `resolution`, `setFullscreen()`. The camera keeps its vertical field of view (`fov`, default 75°) and widens it on narrow screens so at least `minHorizontalFov` (default 60°) stays visible across, which keeps phones in portrait playable. The camera reads no keys itself: a game drives it from its own actions. `camera.turn` and `camera.tilt` (-1 to 1) turn and tilt it every frame at `turnSpeed`/`tiltSpeed` radians per second, the way a drag does; detached, `flyForward`/`flyRight` (-1 to 1) and `flyBoost` fly it at `flySpeed`. `DesktopCamera` turns on a mouse drag and zooms on the wheel; `TouchCamera` drags and pinches. |
| `engine.inputs` | Actions over physical key codes, declared by the `binds` option: `mapActionToKeys(action, ...codes)`, `unmapActionFromKeys(action, ...codes)` (no codes clears the action), `onActionStart`, `onActionStop`, `isActionRunning`, `isInputPressed`, `onPressInput`. Mouse buttons bind as `"Pointer0"`… Keys typed into a text field never reach actions; losing focus releases everything. |
| `engine.network` | `connect(url)`, `send`, `onMessage` (returns a remover), `on("connection" \| "disconnection" \| "reconnection" \| "stats")`, `stats`, and simulated `latency`/`loss` for testing under bad conditions. |
| `engine.assets` | `load(kind, id, source)`, `loadAll(manifest)`, `get`, `instance(id)` for model copies (sharing geometries and materials), `release`, `on("progress" \| "complete" \| "error")`. Kinds: `model` (glTF), `texture`, `sound`, plus `material` and `geometry` for ones built in code, and any kind added with `register(kind, loader)`. A sound's source is a URL or Howler's options with `src`: `{ src: "/music.webm", loop: true, html5: true }` streams long music instead of decoding it whole; `sprite` maps names to `[start, duration]` for `engine.audio.play(id, name)`. Three things to know: a loaded colour texture needs `texture.colorSpace = SRGBColorSpace` (the loader cannot tell colour from data maps); a model keeps its glTF clips on `model.animations`, and so do its copies; copies share their materials, so tinting one copy tints them all; give it a cloned material first. |
| `engine.assets.cache` | Every shared resource by kind and id, freed once on `release`: `get`, `set`, `getOrCreate(kind, id, create)` for a material or geometry built in code once and shared by every mesh, `entries(kind)`, `clear(...kinds)`. |
| `engine.audio` | `play(id)`, `pause`, `stop`, `volume`, `muted`. The context unlocks on the first user gesture. |
| `engine.renderer.textureBuilder` | Textures drawn in code on an `OffscreenCanvas`: `draw(ctx => …, clear?, width?, height?)` hands you a reset 2D context, `save(name)` turns it into a three.js `Texture` stored in the cache as a `texture` under that name, `download(name)` saves a `.png`. One shared builder: draw, save, draw the next. |
| `engine.audio.soundBuilder` | Synthesises sounds in code, for feedback before a game has recorded audio: layers of `tone(type, notes, step, volume?, start?)` (notes one after the other), `sweep(type, low, high, period, repeat?, volume?, start?)` (a siren), `noise(duration, from?, to?, volume?, start?)` (low-passed noise: water, wind, impacts) and `layer(end, build)` for any Web Audio nodes. `save(name)` renders them once into a `sound` in the cache, played with `engine.audio.play(name)` under the master volume and mute; `download(name)` saves a `.wav`. Times are in seconds from the start of the sound. |
| `engine.loop` | `maxFrameRate`, `stats`, `on("frame" \| "frameStart" \| "frameEnd")`. |
| `Text` | `new Text("name", { fontSize, color, outlineWidth, anchorX: "center", billboard: true })` from `phoenix.engine/text`: a three.js mesh, so it goes in an entity's `group`. `preloadFont(url, characters)` builds glyphs ahead of time; `engine.assets.register("font", fontLoader())` loads fonts through the asset manager; `configureText` sets the default font before the first text. `text.destroy()` frees it. Each `Text` is its own draw call and is never batched, so hundreds of labels cost hundreds of draws: hide the far ones. |
| `EditorView` | A development overlay: `const editor = new EditorView(engine); engine.renderer.scene.add(editor); await editor.init("#stats")`. Grid, axes, FPS/ping/bandwidth/TPS panels in that element (TPS: server frames received per second, 0 while the room is still), **F** for a free camera (WASD flies, Shift faster, arrows turn), **V** for wireframe. |
| `engine.renderer.batcher` | `batch(root)` draws the static scenery under `root` in few draw calls: plain meshes become instances of one `BatchedMesh` per material, shadow setting and geometry layout, in place. Sprites, `Text`, invisible objects and meshes with `userData.batch = false` stay as they are. For things that never move: a batched mesh no longer exists on its own. The batches are freed with the renderer. |
| `storage` | `localStorage`, falling back to `sessionStorage`, then to memory, where storage is blocked. |

### UI kit and native feel

```ts
import "phoenix.engine/native.css";                        // first, so the game's styles override it
import Joystick from "phoenix.engine/ui/Joystick.svelte";  // multi-touch virtual stick
import GridLayout from "phoenix.engine/ui/GridLayout.svelte";
```

- **`Joystick`**: placed with `top`/`left`/`right`/`bottom`, sized with `size` (any CSS length), with a `deadZone` (default 0.15). With a `stickyZone` element, pressing anywhere in it brings the stick to the finger, and `fade` hides it while nobody holds it. `onmove` gives `{ x, y, angle, distance }`: `angle` counterclockwise from the right, `distance` from 0 to 1 with the dead zone already taken out. Use these as they are. `onstart` and `onstop` bracket a touch. Styled through CSS variables: `--joystick-size`, `--joystick-base`, `--joystick-base-border`, `--joystick-blur`, `--joystick-layer`, `--joystick-fade-time`, `--joystick-stick`, `--joystick-stick-size`, `--joystick-stick-border`, `--joystick-stick-held`, `--joystick-return`. Unset, they fall back to the `--ui-*` tokens a game may define (`--ui-sunken`, `--ui-accent-fill`, …), then to built-in colours.
- **`GridLayout`**: a full-screen 3 × 3 grid filled through snippets (`top_left`, `top_center`, … `bottom_right`), with `padding` and `gap`. Each cell stacks its content along `<cell>_direction`: `"row"` by default in the centre column, `"column"` on the sides. The grid lets clicks through except on what a cell holds.

The engine's `native` option (on by default) blocks the context menu, pinch zoom and dragging out of the page; `native.css` makes the page unselectable and removes overscroll and tap highlights.

### Shared utilities

`Vector3` and `ObservableVector3` (mutate in place: `set`, `add`, `scale`, `normalize`, `dot`, `hasUpdated`; `cross`/`delta`/`midpoint`/`project` write into an optional `out`; y-up spherical helpers where `azimuth` is the yaw facing the vector), `SpatialGrid` (what is within a radius of a point), `Quaternion` and `ObservableQuaternion` (`setFromEuler`, `setFromYaw`, `setFromAxisAngle`, `toEuler`, `yaw`, `multiply`, `invert`, `slerp`, `angleTo`, `pack`/`unpack`, `hasUpdated(angle)`; `q` and `-q` count as the same rotation), `Interpolator` (`lerp`, `lerpAngle`, `lerpVector`, `slerpQuaternion`, tweens with an `InterpolationCurve`), angles (`angleDistance`, `signedAngleDistance`, `normalizeAnglePI`/`normalizeAngle2PI`, `closestAngle`, degrees ↔ radians), animation curves over time (`wave`, `syncedWave`, `fadeInHoldAndFadeOut`), colours (`hex(0xff8800)` → `"#ff8800"`, `hexToRgba`, `rgbaToHex`, `extractRGBA`), `BufferWriter.toPrecision`/`BufferReader.fromPrecision` (a value in a range to and from a few bits), `get`/`post`/`put`/`del` (JSON over HTTP with a timeout and retries; they return an `HTTPResponse<T>` and take `RequestSettings`), `clamp`, `wrap`, `randomInt`/`randomFloat`/`randomElement`/`weightedRandom` (each takes an optional random source, for seeded runs), `EventEmitter` (`on` returns an unsubscribe function), `Timer`/`Interval`/`Timeout`, `IDAllocator`, `CounterMap`, `deepMerge`/`deepCopy`, `normalizeText`/`validateText`/`censorText`, and `log`/`warn`/`error`.

## Common tasks

Each of these already exists in the engine. A game that writes its own version ends up with two of everything: two caches, two volume controls, two texture pipelines.

**A texture drawn in code**, once, shared by every mesh that uses it:

```ts
const texture = await engine.renderer.textureBuilder
	.draw((ctx) => {
		const gradient = ctx.createLinearGradient(0, 0, 0, 256);
		gradient.addColorStop(0, "#87ceeb");
		gradient.addColorStop(1, "#ffffff");
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 256, 256);
	}, true, 256)
	.save("sky");

engine.assets.get("texture", "sky"); // the same texture, anywhere else
```

**A sound made in code**, played like a loaded one:

```ts
await engine.audio.soundBuilder.tone("triangle", [520, 780, 1170], 0.07).save("pickup");
engine.audio.play("pickup");
```

**A material or geometry shared by many meshes**, built the first time it is asked for and freed with the cache:

```ts
const wood = engine.assets.cache.getOrCreate("material", "wood", () => new MeshStandardMaterial({ color: 0x8b5a2b }));
const box = engine.assets.cache.getOrCreate("geometry", "crate", () => new BoxGeometry(1, 1, 1));
this.group.add(new Mesh(box, wood));
```

**Files**, loaded together with progress:

```ts
engine.assets.on("progress", (loaded, total) => (bar.value = loaded / total));
await engine.assets.loadAll({
	model: { tree: "/models/tree.glb" },
	texture: { grass: "/textures/grass.png" },
	sound: { jump: "/sounds/jump.webm" },
});
this.group.add(engine.assets.instance("tree")!);
```

**The camera following the player**, and turning from keys:

```ts
engine.renderer.camera.target = player.position;
engine.renderer.camera.turn = (engine.inputs.isActionRunning("turnRight") ? 1 : 0) - (engine.inputs.isActionRunning("turnLeft") ? 1 : 0);
```

**A name tag** over an entity:

```ts
const tag = new Text(name, { fontSize: 0.3, anchorX: "center", billboard: true });
tag.position.y = 2;
this.group.add(tag);
```

**Static scenery in few draw calls**: build it under one group, then `engine.renderer.batcher.batch(group)`.

**A smooth value** in a frame: `Interpolator.lerp(current, target, factor, deltaTime)`, `lerpAngle` for angles, `slerpQuaternion` for rotations. **A number on the wire in few bits**: `writer.writeUint8(BufferWriter.toPrecision(value, max, 8))` and `BufferReader.fromPrecision(reader.readUint8(), max, 8)`.

## Design principles

- **Server-authoritative.** The server decides; clients send intentions and draw.
- **Classes, not components.** Game objects are class hierarchies with their own `update`. No ECS, no system registry.
- **One copy of every shared dependency.** Rapier, three.js and Svelte are peers, imported directly by the game.
- **Nothing on the wire that did not change.** Encode once, interest per socket, sleeping bodies are free.
- **Typed end to end.** Kind names, event names, payloads, action names and spawn options are all checked at compile time.
- **The engine provides mechanisms; the game decides.** Room codes, visibility, controls, UI and rules belong to the game.
- **No allocation in a tick.** Hot paths reuse scratch vectors instead of creating new ones.

## Development

### Commands

```sh
bun run init          # install, set up git hooks
bun run build         # compile client and server into dist/
bun run test          # engine tests (bun test tests)
bun run types:check   # typecheck client, server and tests
bun run format        # Biome: tabs, double quotes, 320 columns
```

The repository is a Bun workspace: `client/`, `server/` and `shared/` build separately into one `dist/`, matching the `exports` map in [package.json](./package.json). There is no dev server here — the engine runs inside a game.

### Tests

[`tests/`](./tests) runs against the engine's source, with Bun's test runner. It mirrors the engine, one file per module, with shared rooms, boxes and sockets in [`fixtures.ts`](./tests/fixtures.ts):

- `shared/`: `math` (vectors, quaternion packing within 0.25°, slerp, tweens, angles, random), `utils` (timers, colours), `networking` (one handler per event), `SpatialGrid`.
- `server/`: `replication` (a real room and a real client world: spawns, updates, rotations, despawns, view, many entities, several sockets), `physics` (bodies followed, sleeping bodies left alone), `rooms` (quick play, occupancy, destroying), `loop` (rate, real time, the cap after a stall), `network` and `http` (origins on the socket upgrade and HTTP routes, rate limits).
- `client/`: `inputs` (actions, repeats, rebinding, focus loss, mouse buttons), `camera` (field of view, turning, tilting, free flight), `batch` (the batcher), `audio` (WAV encoding).
- [`api-map.test.ts`](./tests/api-map.test.ts): every export of every entry point, and every UI component, is listed in the [API map](./API.md).

Gameplay behaviour — how the physics feels — is tested in the game, against its own entities (see the template's `server/tests`).

### Releasing a change

Games install the engine from GitHub and nothing builds it on install, so **`dist/` is committed**:

1. `rm -rf dist && bun run build` — a clean build, so moved or deleted files do not leave stale copies behind;
2. `bun run test` and `bun run types:check`;
3. commit and push;
4. in the game: `bun update phoenix.engine`.

Every runtime dependency of `dist/` must be listed in the **root** `package.json` — the workspaces' own `package.json` files are ignored by anything installing the engine. Type packages for libraries that appear in the public `.d.ts` files (`@types/howler`, `@types/stats.js`) belong in `dependencies` too, or games see those types as `any`.

### Pitfalls

- **Two copies of Rapier** (`undefined is not an object (evaluating 'mA.rawshape_cuboid')`): the game and the engine resolve different copies. Happens under `bun link`, when the versions stop overlapping, or when the game imports another Rapier package (`rapier3d-compat` instead of `rapier3d-simd-compat`). Check `bun pm ls --all | grep rapier3d`.
- **Vite and CommonJS dependencies** (`does not provide an export named 'Howl'`): a game that excludes `phoenix.engine` from Vite's `optimizeDeps` must include its CommonJS dependencies through it: `"phoenix.engine > howler"`, `"phoenix.engine > stats.js"`.
- **A stale `dist/`**: the game runs the built engine, not its source. Rebuild after every change.
- **A stale dev server**: a game's dev servers do not reload `node_modules`. After `bun update phoenix.engine`, restart them, or client and server run different engine builds and no frame decodes.

## License

**© 2026 Phoenix Studio. All rights reserved.**

This software is the proprietary and confidential work of EL KARATI Nassim. Permission is granted to the licensee only to use the software as expressly permitted by a separate license agreement or purchase order. Redistribution, resale, sublicensing, reverse engineering, decompilation, or modification of the software is strictly prohibited unless expressly authorized in writing.

No license is granted for use of this code. Any use, reproduction, or distribution requires prior written authorization. See [LICENSE](./LICENSE) for the full text.

For licensing inquiries, contact: [nassim.elkarati@gmail.com](mailto:nassim.elkarati@gmail.com)
