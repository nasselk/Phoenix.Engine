# Phoenix Engine

A TypeScript engine for **server-authoritative, real-time multiplayer 3D games on the web**. It is a library, not an application: a game installs it, builds its own client and server on top, and the engine supplies the machinery in between — rooms, physics, replication, a typed binary protocol, rendering, input, audio and assets.

The fastest way to start a game is the [Phoenix Engine Template](https://github.com/nasselk/Phoenix.Engine-Template), which is a complete, playable game wired to this engine.

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
| `phoenix.engine` | both | The shared surface: `defineEntities`, math (`Vector3`, `ObservableVector3`, `Interpolator`), binary `BufferReader`/`BufferWriter`, protocol types, timers, `EventEmitter`, logger, text validation. For code a game shares between its client and server. |
| `phoenix.engine/server` | Bun | Everything shared, plus the server `Engine`, `World` (a room), `Entity`/`PositionEntity`/`MovingEntity` that **write** themselves, `NetworkSystem`, `Socket`, `GameLoop`, `initPhysics`. |
| `phoenix.engine/client` | browser | Everything shared, plus the client `Engine`, `World` (a mirror), `Entity`/`PositionEntity`/`MovingEntity` that **read** themselves, `RenderSystem`, cameras, `InputSystem`, `AudioSystem`, `AssetManager`, `NetworkSystem`, `EditorView`, `storage`. |
| `phoenix.engine/text` | browser | `Text`: crisp signed-distance-field text in the scene, optionally facing the camera. Separate so a game that draws no text bundles none. |
| `phoenix.engine/native.css` | browser | Default styles that make the page behave like an app (no selection, no overscroll, no tap highlight). |
| `phoenix.engine/ui/<Name>.svelte` | browser | Svelte 5 components: `Joystick`, `GridLayout`. |

## Installation

The engine is installed from GitHub, with its peer dependencies installed by the game next to it:

```sh
bun add github:nasselk/Phoenix.Engine
bun add @dimforge/rapier3d-compat   # server: physics
bun add three svelte                # client: rendering and UI
```

| Peer dependency | Version | Needed by |
| --- | --- | --- |
| `@dimforge/rapier3d-compat` | `^0.20.0` | the server |
| `three` | `^0.186.0` | the client |
| `svelte` | `^5.57.1` | the client, when using the UI kit |

They are peers so that the engine and the game share **one copy** of each. With Rapier this is not a nicety: two copies means two WebAssembly instances, one of which is never initialised, and objects from one cannot be used in the other. Import Rapier, three.js and Svelte **directly from their own packages** in game code; the engine does not re-export them.

## Quick start

A bouncing ball, simulated on the server and drawn on every connected client.

### Server

```ts
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat";
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
| `loop` | `TPS` (ticks per second), `turbo`, `speed`. |
| `rooms` | `maximum` rooms per process. |

`await engine.init()` loads Rapier, opens the network and starts the loop. Rooms: `createRoom(capacity?, code?)` — `capacity` is how many entities the room holds at once (default 65535) —, `getRoom(code)`, `destroyRoom(code)`, `rooms`.

**Client** — `new Engine(options)`:

| Option | |
| --- | --- |
| `world` | `{ entities, context }`: the same kind names as the server, mapped onto the classes that draw them. |
| `network` | `in`/`out` event lists and schemas: the mirror of the server's declaration. |
| `inputs` | `{ binds }`: every action and its default keys. The keys of this object are the only action names the input API accepts. |
| `loop` | `FPS` cap (`Infinity` for the display's rate), `speed`. |
| `renderer` | Resolution, background, fullscreen, WebGL/WebGPU, and three.js renderer parameters. |
| `audio` | Initial volume and mute. |
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
room.on("spawn" | "destroy" | "update", …);
```

On the **server**, a world is a **room**: it also has an `inviteCode`, the `sockets` that joined it, a Rapier `physics` world, and `spawn`, `join`, `leave`, `frame`, `clean` and `broadcast`. `socket.room` says which room a socket is in; `socket.data` is the game's own per-socket data, typed by augmenting `SocketData`:

```ts
declare module "phoenix.engine/server" {
	interface SocketData {
		player?: Player;
	}
}
```

On the **client**, a world is a **mirror**: `sync(reader)` applies a frame. Replicated entities carry the server's (positive) ids; entities the client spawns itself get negative ids, so the two never collide and local ones never go on the wire.

### Entities

Every game object is a class. Each side has its own chain, and they differ in exactly the half of the wire they handle:

| | Server (`phoenix.engine/server`) | Client (`phoenix.engine/client`) |
| --- | --- | --- |
| `Entity` | `update(dt)`, `serialize(writer)`, `serializeUpdate(writer)`, `isDirty`, `clean()` | `update(dt)`, `deserialize(reader)`, `deserializeUpdate(reader)`, and `render(dt)`: a hook for the game to refresh visuals (after a size change, say); the engine never calls it |
| `PositionEntity` | `position`/`rotation` (observable vectors), a Rapier `body`, `embody(desc, ...shapes)`, `beforePhysics()`/`afterPhysics()` | `position`/`rotation` smoothed toward the server's, a three.js `group` placed there every frame |
| `MovingEntity` | Options for a starting `velocity`, `gravityScale`, `damping`; `applyImpulse` | — |

A **box, a crate, a player are the game's classes**, written once per side, extending these. Behaviour goes in the entity's own `update`. Lifecycle hooks are `onSpawn` and `onDestroy`; `destroy()` removes an entity.

### The entity registry

```ts
// server                                        // client
defineEntities({ player: Player, crate: Crate }); defineEntities({ player: PlayerView, crate: CrateView });
```

A **name** is what the two sides agree on — never a class. A kind's wire code is its place in the sorted list of names, so both sides must declare the same names. The registry is also what types `room.spawn("player", options)`: the options are the class's own constructor options.

### The tick

Every server tick, for every room, in this order:

1. every entity's `update(dt)` — game rules, input turned into velocity;
2. the physics step: `beforePhysics()` on every body (code-driven rotation goes in), `physics.step()`, then `afterPhysics()` (Rapier's positions come back out);
3. the room's `"update"` event — where a game sends its frames, then calls `room.clean()`.

So what goes out in a frame is always the state *after* contact. The client runs the same shape every display frame: `world.update(dt)` (every entity eases toward the last state the server sent, and its `group` follows), then the draw.

### Physics

Each room owns a Rapier world with gravity `GRAVITY` (−9.81). An entity joins it by calling `embody` in its constructor:

```ts
this.embody(RigidBodyDesc.dynamic(), ColliderDesc.cuboid(0.5, 0.5, 0.5).setFriction(0.6));
```

- **Rapier owns the motion.** Velocity, mass and gravity live on `entity.body`; read and change them there. Pass `wakeUp: true` when changing a sleeping body (`setLinvel(v, true)`), or the change is ignored.
- **Body types**: `dynamic` (moved by forces and contacts), `fixed` (floors, walls), `kinematicPositionBased`/`kinematicVelocityBased` (moved by code, pushes others, is never pushed).
- **Mass** comes from the colliders: `density × volume`, or `ColliderDesc.setMass(m)`.
- **Rotation**: a body with all rotations locked (`lockRotations()`) is turned by code — set `entity.yaw` and it goes into the body before each step. Otherwise the physics turns it, and its rotation comes back out.
- **`body.userData`** is the entity, so a raycast or contact can find what it hit: `hit.collider.parent()?.userData`.
- **Sleeping**: a body at rest sleeps; its position stops changing, so it drops out of every frame.

### Replication

`room.frame(socket, visible)` builds one socket's frame from what it last received to `visible`:

```
[u8 event] [u16 despawns][id]…  [u16 spawns][kind u8][id u16][serialize]…  [u16 updates][id u16][serializeUpdate]…
```

- **What a socket sees is the game's call**: all entities, a chunk, a view cone. What leaves `visible` despawns; what enters it spawns.
- **Each entity is encoded once per tick** into a shared buffer; every socket's frame copies those bytes.
- **Records carry no length**: each entity reads exactly what its server side wrote. `serialize`/`deserialize` must write and read the same fields in the same order, `super` first.
- **A still room sends nothing**: an entity is only in the updates while `isDirty`; `frame` returns `undefined` when there is nothing to say.
- **`room.clean()` counts the changes as sent** — call it once every socket had its frame this tick.

Adding a field to a kind changes no protocol and no schema: it is two lines in that kind's two classes.

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

An event's code is its index in its list, so both sides must use the same lists — keep them in a folder both import. An event without a schema carries raw bytes (the `sync` frame) or nothing. The server enforces `limits` per event (`maxRate`, `byteLength`) and closes connections that break them. Sessions survive a dropped connection: the client reconnects and resumes with a ticket.

Socket API: `socket.send(event, data)`, `socket.cork(fn)` (batch), `socket.disconnect()`, `room.broadcast(event, data)`.

### Client systems

| System | |
| --- | --- |
| `engine.renderer` | three.js `scene`, `camera` (an `OrbitCamera`: `target`, `detach()`/`reattach()`, zoom), `view` (the canvas to mount), `resolution`, `setFullscreen()`. `DesktopCamera` orbits with the mouse and flies with WASD when detached; `TouchCamera` drags and pinches. |
| `engine.inputs` | Actions over physical key codes: `mapActionToKeys(action, ...codes)`, `unmapActionFromKeys(action, ...codes)`, `onActionStart`, `onActionStop`, `isActionRunning`, `isInputPressed`, `onPressInput`. Mouse buttons bind as `"Pointer0"`… Keys typed into a text field never reach actions; losing focus releases everything. |
| `engine.network` | `connect(url)`, `send`, `onMessage`, `on("connection" \| "disconnection" \| "reconnection" \| "stats")`, `stats`, and simulated `latency`/`loss` for testing under bad conditions. |
| `engine.assets` | `load(kind, id, source)`, `loadAll(manifest)`, `get`, `instance(id)` for model copies, `release`. Kinds: `model` (glTF), `texture`, `sound`, plus `material` and `geometry` for ones built in code and shared through `assets.cache`. |
| `engine.audio` | `play(id)`, `pause`, `stop`, `volume`, `muted`. The context unlocks on the first user gesture. |
| `engine.loop` | `maxFrameRate`, `stats`, `on("frame" \| "frameStart" \| "frameEnd")`. |
| `Text` | `new Text("name", { fontSize, billboard: true })` from `phoenix.engine/text`. |
| `EditorView` | A development overlay: grid, axes, FPS/latency/bandwidth panels, **F** for a free camera, **V** for wireframe. |
| `storage` | `localStorage` that falls back to memory where storage is blocked. |

### UI kit and native feel

```ts
import "phoenix.engine/native.css";                        // first, so the game's styles override it
import Joystick from "phoenix.engine/ui/Joystick.svelte";  // multi-touch virtual stick
```

The engine's `native` option (on by default) blocks the context menu, pinch zoom and dragging out of the page; `native.css` makes the page unselectable and removes overscroll and tap highlights.

### Shared utilities

`Vector3` and `ObservableVector3` (mutate in place: `set`, `add`, `scale`, `normalize`, `dot`, `hasUpdated`), `Interpolator` (`lerp`, `lerpAngle`, tweens), `clamp`, `wrap`, `randomInt`/`randomFloat`/`randomElement`, `EventEmitter` (`on` returns an unsubscribe function), `Timer`/`Interval`/`Timeout`, `IDAllocator`, `CounterMap`, `deepMerge`/`deepCopy`, `normalizeText`/`validateText`/`censorText`, and `log`/`warn`/`error`.

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

[`tests/`](./tests) runs against the engine's source, with Bun's test runner:

- [`replication.test.ts`](./tests/replication.test.ts) — a real server room and a real client world: spawns, updates, each rotation axis, despawns, leaving and re-entering view, hundreds of entities in a frame, several sockets.
- [`inputs.test.ts`](./tests/inputs.test.ts) — actions, repeats, several keys per action, rebinding while held, focus loss.

Gameplay behaviour — how the physics feels — is tested in the game, against its own entities (see the template's `server/tests`).

### Releasing a change

Games install the engine from GitHub and nothing builds it on install, so **`dist/` is committed**:

1. `rm -rf dist && bun run build` — a clean build, so moved or deleted files do not leave stale copies behind;
2. `bun run test` and `bun run types:check`;
3. commit and push;
4. in the game: `bun update phoenix.engine`.

Every runtime dependency of `dist/` must be listed in the **root** `package.json` — the workspaces' own `package.json` files are ignored by anything installing the engine. Type packages for libraries that appear in the public `.d.ts` files (`@types/howler`, `@types/stats.js`) belong in `dependencies` too, or games see those types as `any`.

### Pitfalls

- **Two copies of Rapier** (`undefined is not an object (evaluating 'mA.rawshape_cuboid')`): the game and the engine resolve different copies. Happens under `bun link`, or when the versions stop overlapping. Check `bun pm ls --all | grep rapier3d`.
- **Vite and CommonJS dependencies** (`does not provide an export named 'Howl'`): a game that excludes `phoenix.engine` from Vite's `optimizeDeps` must include its CommonJS dependencies through it: `"phoenix.engine > howler"`, `"phoenix.engine > stats.js"`.
- **A stale `dist/`**: the game runs the built engine, not its source. Rebuild after every change.

## License

**© 2026 Phoenix Studio. All rights reserved.**

This software is the proprietary and confidential work of EL KARATI Nassim. Permission is granted to the licensee only to use the software as expressly permitted by a separate license agreement or purchase order. Redistribution, resale, sublicensing, reverse engineering, decompilation, or modification of the software is strictly prohibited unless expressly authorized in writing.

No license is granted for use of this code. Any use, reproduction, or distribution requires prior written authorization. See [LICENSE](./LICENSE) for the full text.

For licensing inquiries, contact: [nassim.elkarati@gmail.com](mailto:nassim.elkarati@gmail.com)
