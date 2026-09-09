# Phoenix Engine

A TypeScript multiplayer game engine, distributed as a library rather than a runnable application. Phoenix Engine doesn't start itself — it's a dependency that a game imports, wires up, and drives from its own client and server entry points.

## Table of contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Peer dependencies](#peer-dependencies)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Assets](#assets)
- [License](#license)

## Overview

Phoenix Engine provides the shared plumbing for a real-time multiplayer game: a client-side renderer and network layer, a server-side game loop and world, and a set of isomorphic utilities (binary serialization, math, timers, events) used by both sides to stay in sync.

It ships as a single package with three subpath exports, one per workspace:

| Import path | Workspace | Contains |
| --- | --- | --- |
| `phoenix.engine` | [`shared/`](./shared) | Isomorphic code shared by client and server |
| `phoenix.engine/client` | [`client/`](./client) | Browser-side `Engine`: rendering, networking, input, assets, UI |
| `phoenix.engine/server` | [`server/`](./server) | Server-side `Engine`: game loop, rooms |

There is no `start`/`dev` command in this repository — the engine has nothing to serve on its own. A consuming game creates its own client bundle and server process, imports `Engine` from the relevant subpath, and calls into it.

## Architecture

The repo is a Bun workspace with three packages that build independently but share a single TypeScript project and `dist/` output, matching the `exports` map in [package.json](./package.json).

**`client/`** exposes an `Engine` class ([client/src/index.ts](./client/src/index.ts)) that owns:
- **Rendering** — [`RenderSystem`](./client/src/rendering/RenderSystem.ts) is an abstract render loop (requestAnimationFrame-driven, with a frame-rate cap) implemented by two backends: [`PixiRenderer`](./client/src/rendering/lib/2D/2D.ts) (2D, via pixi.js) and [`ThreeRenderer`](./client/src/rendering/lib/3D/3D.ts) (3D, via three.js). `new Engine("2D" | "3D")` picks which one gets instantiated.
- **Networking** — [`NetworkSystem`](./client/src/networking/NetworkSystem.ts) wraps a WebSocket, encoding/decoding messages through the shared binary schema layer, and handles session negotiation and reconnection.
- **Input** — keyboard, mouse, gamepad, mobile touch and gesture handling under [`client/src/controls`](./client/src/controls).
- **Asset loading** — texture, audio and font loaders under [`client/src/loaders`](./client/src/loaders).
- **UI kit** — a set of Svelte components ([`client/UI/components`](./client/UI/components): windows, toolbars, context menus, sliders, etc.) for building in-game UI on top of the engine.

**`server/`** exposes an `Engine` class ([server/src/index.ts](./server/src/index.ts)) that owns:
- **`GameLoop`** ([server/src/GameLoop.ts](./server/src/GameLoop.ts)) — a fixed-timestep tick loop (TPS-capped, with an optional `turbo` mode that ticks as fast as the event loop allows) that emits `tick` events and runs registered timers, driving every room.
- **Rooms** — a [`GameRoom`](./server/src/room.ts) per match: a `World` subclass with an invite code (which doubles as its pub/sub topic) and the set of entities a connection is driving. All ticked by the one loop, each running its own phases. A room is the authority for the clients mirroring it, so it records what spawns and what dies and can write that out as a frame.

**`shared/`** has no runtime behavior of its own — it's the layer both sides import from by relative path today (the root `phoenix.engine` export point is reserved for it and is still being filled in as the public surface stabilizes). It contains:
- **Entities** — [`Entity`](./shared/world/entity.ts) is identity and lifetime: an id, a spawn time, `update`/`onSpawn`/`onDestroy`. That is all `shared/` has, because that is where the two sides stop meaning the same thing. Each side then exports its own chain over the top — `Entity` -> `PositionEntity` (an `ObservableVector3` position) -> `MovingEntity` (a `Vector3` velocity, integrated per tick) — and they differ in exactly the half of the wire they carry: the server's [`serialize`/`serializeUpdate`/`isDirty`](./server/src/world/entity.ts), the client's [`deserialize`/`deserializeUpdate`](./client/src/world/entity.ts). An authority never reads entities and a mirror never writes them, so neither side carries the other's half. `import { PositionEntity } from "phoenix.engine/server"` gets the one that writes; the same line against `/client` gets the one that reads. The vectors mutate in place, so an entity carries the whole of `shared/libs/math/vector3D` — distance, normalize, dot, cross, rotate, interpolate — without allocating in a tick; and `position.hasUpdated(delta)` / `position.store()` is how the server asks what actually moved. A box, a crate, a player are the *game's* classes, one per side; behaviour goes in the entity's own `update`. There is no component registry and no render system — an entity that draws itself adds its mesh to the scene in `onSpawn` and takes it out in `onDestroy`.
- **World** — [`World`](./shared/world/world.ts) is the container and the tick: it holds the entities, hands out ids, emits `spawn`/`destroy`, and `world.update(dt)` runs the whole frame. Lookup by kind is `world.each(Player, ...)` / `all` / `first` / `count`, filtered by `instanceof`. Work that isn't one entity's business subscribes with `world.onUpdate(fn, { phase, priority })` and gets an unsubscribe back — no base class to extend and no registry. Phases are Input, PreUpdate, Update, PostUpdate, Network, Render; the entities themselves run at Update. Putting a world on a wire splits the same way its entities do: [`serialize`/`serializeSync`](./server/src/world/world.ts) on the server's World, [`sync`](./client/src/world/world.ts) on the client's.
- **Entity registry** — [`defineEntities`](./shared/world/registry.ts) names a game's entity kinds, and each side maps the same names onto its own classes: `{ player: Player }` on the server, `{ player: RenderedPlayer }` on the client. A name is what survives a network, so it is what the two sides agree on — never a class. That makes `world.spawn("player", socket.id)` typed off the declaration, and it is what a wire frame carries instead of a class.
- **Replication** — with a registry, a world puts itself on a wire. `room.serializeSync(writer)` writes what spawned, what moved and what died since the last call and returns false when that is nothing; `room.serialize(writer)` writes the lot, for a client that has just joined; `world.sync(reader)` applies either at the other end, since they are the same frame with different sections filled in. What is *in* an entity's bytes is the entity's own business — it overrides `serialize`/`deserialize` for its spawn state and `serializeUpdate`/`deserializeUpdate`/`isDirty` for what changes — so adding a kind with a field of its own changes no protocol and no schema. A mirror world spawns replicated entities under the authority's ids and gives its own local ones negative ids, so the two can never collide.
- **Networking protocol** — the typed wire contract ([shared/networking/protocol.ts](./shared/networking/protocol.ts)): each side declares its `in`/`out` event lists and [BinarySchema](https://github.com/nasselk/BinarySchema) payload schemas, and `send`/`onMessage` are typed by them. Session tickets and routes are in [session.ts](./shared/networking/session.ts).
- **Math** — vectors, angles, polygons, interpolation and animation helpers ([shared/libs/math](./shared/libs/math)).
- **Utilities** — `EventEmitter`, logger, timers (`Timer`/`Interval`/`Timeout`/tick), `IDAllocator`, bitset, and text validation ([shared/utils](./shared/utils)).

## Peer dependencies

The engine does not bundle its rendering or UI dependencies — they're declared as optional [`peerDependencies`](./package.json):

| Package | Used for | Required when |
| --- | --- | --- |
| [`pixi.js`](https://pixijs.com/) `^8.0.0` | 2D renderer backend | Instantiating `new Engine("2D")` |
| [`three`](https://threejs.org/) `^0.185.1` | 3D renderer backend | Instantiating `new Engine("3D")` |
| [`svelte`](https://svelte.dev/) `^5.0.0` | The bundled UI component kit | Using any component from `client/UI` |

Because all three are optional, a 2D game only needs to install `pixi.js`, a 3D game only `three`, and neither is forced to take on the other's bundle weight. `svelte` is only needed if the consuming project uses the engine's prebuilt UI components rather than building its own.

## Installation

This package is private and not published to a registry, so consuming projects install it directly from the repository, alongside whichever peer dependency their renderer needs:

```pwsh
bun add github:nasselk/Phoenix.Engine
bun add pixi.js   # if using the 2D renderer
bun add three     # if using the 3D renderer
bun add svelte    # if using the bundled UI kit
```

Requires Node.js `>=22.0.0 <23.0.0` or `>=24.0.0` (see [`engines`](./package.json)) at runtime, and [Bun](https://bun.sh/) to install and build.

## Usage

Each subpath resolves to that workspace's built output (`dist/<workspace>`, with generated `.d.ts` files), as declared in the `exports` map.

**Client**, in a browser bundle:

```ts
import { defineEntities, Engine, PositionEntity } from "phoenix.engine/client";
import { BoxGeometry, Mesh, MeshLambertMaterial, type Object3D } from "three";

// What a `crate` is *on this side*: a mesh. The server's crate is a different class entirely.
class Crate extends PositionEntity {
	public static view: Object3D;

	private readonly mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: 0xe74c3c }));

	public override onSpawn(): void {
		Crate.view.add(this.mesh);
	}

	public override update(): void {
		const { x, y, z } = this.position;

		this.mesh.position.set(x, y, z);
	}

	public override onDestroy(): void {
		Crate.view.remove(this.mesh);
	}
}

// The server's entity kinds, mapped onto the classes that draw them here.
const entities = defineEntities({ crate: Crate });

const engine = new Engine({ renderer: "3D", entities }); // or "2D" for the pixi.js renderer

Crate.view = engine.renderer.world;

document.body.appendChild(engine.renderer.view);

await engine.init();

engine.world.spawn("crate").position.set(0, 0.5, 0);

// One line of netcode: a frame in, a world updated. Entities read their own bytes back.
engine.network.onMessage("sync", (reader) => engine.world.sync(reader));

await engine.network.connect("https://your-game-server.example");
```

**Server**, under Bun/Node:

```ts
import { BufferWriter, defineEntities, Engine, MovingEntity, Phase, PositionEntity } from "phoenix.engine/server";

class Ball extends MovingEntity {
	public constructor(x: number = 0, y: number = 10, z: number = 0) {
		super(x, y, z);

		this.velocity.set(0, -5, 0);
	}

	public override update(deltaTime: number): void {
		super.update(deltaTime); // integrate velocity into position

		if (this.position.y < 0.5) {
			this.velocity.y = Math.abs(this.velocity.y);
		}
	}
}

class Floor extends PositionEntity {}

// The kinds this game replicates. The client declares the same names against its own classes.
const entities = defineEntities({ ball: Ball, floor: Floor });

const engine = new Engine({ entities });
const room = engine.createRoom("main");

room.spawn("floor");
room.spawn("ball", 0, 10, 0);

// Work that spans entities subscribes to the tick and says when it wants to run. Here, the frame:
// what spawned, what moved and what died, written by the entities themselves.
const stop = room.onUpdate(() => {
	const writer = new BufferWriter();

	writer.advanceBytes(1); // the protocol stamps the event code into byte 0 as it sends

	if (room.serializeSync(writer)) {
		engine.network.broadcast(room.inviteCode, "sync", writer);
	}
}, { phase: Phase.Network });

await engine.init(); // starts the loop that ticks every room
```

The consuming game is responsible for the rest of the wiring — mounting the renderer's canvas, spawning its entities, defining the actual network event schemas, etc. Phoenix Engine provides the machinery, not the game loop's contents.

## Development

To work on the engine itself (not a game consuming it):

1. Clone the repository.
2. Install workspace dependencies (this also sets up git hooks via Husky):
   ```pwsh
   bun run init
   ```
3. Build. This runs `tsc` across the whole workspace and produces the `dist/` output that the `exports` map points to:
   ```pwsh
   bun run build
   ```
   Or build a single workspace: `bun run build:client` / `bun run build:server`.
4. Type-check without emitting:
   ```pwsh
   bun run types:check
   ```
5. Format with [Biome](https://biomejs.dev/) (tabs, double quotes, 320-column width — the linter is currently off, formatting only):
   ```pwsh
   bun run format
   ```

There's no dev server to run here since the engine has no standalone entry point — to try changes against a real game, build the engine and point the consuming project's dependency at your local checkout (e.g. `bun link`).

## Assets

For best performance, either use WebP (loading speed) or KTX2 (rendering speed) for textures loaded through [`client/src/loaders`](./client/src/loaders).

- WebP encoders: [WebP encoders](https://storage.googleapis.com/downloads.webmproject.org/releases/webp/index.html)
- KTX2 encoders: [KTX2 encoders](https://github.com/KhronosGroup/KTX-Software/releases)

## License

**© 2026 Phoenix Studio. All rights reserved.**

This software is the proprietary and confidential work of EL KARATI Nassim. Permission is granted to the licensee only to use the software as expressly permitted by a separate license agreement or purchase order. Redistribution, resale, sublicensing, reverse engineering, decompilation, or modification of the software is strictly prohibited unless expressly authorized in writing.

No license is granted for use of this code. Any use, reproduction, or distribution requires prior written authorization. See [LICENSE](./LICENSE) for the full text.

For licensing inquiries, contact: [nassim.elkarati@gmail.com](mailto:nassim.elkarati@gmail.com)
