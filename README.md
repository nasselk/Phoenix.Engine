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
- **Rendering** — [`RenderSystem`](./client/src/rendering/RenderSystem.ts), the three.js renderer: canvas, scene and camera, with an [`OrbitCamera`](./client/src/rendering/lib/Camera.ts) that can orbit a target or detach and fly freely. The engine is 3D only.
- **Assets** — [`AssetManager`](./client/src/assets/AssetManager.ts) (`engine.assets`) loads glTF models, textures, sounds and any registered kind by id, joins duplicate requests, reports `progress` and `complete`, and hands out model copies with `instance`. What it loads lives in an [`AssetCache`](./client/src/assets/AssetCache.ts), which also holds materials and geometries built in code, and frees them on `release`.
- **Audio** — [`AudioSystem`](./client/src/audio/AudioSystem.ts) (`engine.audio`) plays sounds loaded as the `sound` asset kind (a URL, or `{ src, sprite, html5, … }` for format fallbacks, sprite maps and streaming), and owns the volume, the mute and the audio context.
- **Text** — [`Text`](./client/src/text/Text.ts) from `phoenix.engine/text`: crisp signed-distance-field text in the scene, laid out by [troika-three-text](https://github.com/protectwise/troika/tree/main/packages/troika-three-text), with engine defaults, a `billboard` flag to face the camera, and `preloadFont`. A separate entry point, so a game that draws no text bundles none of it.
- **Networking** — [`NetworkSystem`](./client/src/networking/NetworkSystem.ts) wraps a WebSocket, encoding/decoding messages through the shared binary schema layer, and handles session negotiation and reconnection.
- **Input** — keyboard, mouse, gamepad, mobile touch and gesture handling under [`client/src/controls`](./client/src/controls).
- **Asset loading** — texture, audio and font loaders under [`client/src/loaders`](./client/src/loaders).
- **UI kit** — a set of Svelte components ([`client/UI/components`](./client/UI/components): windows, toolbars, context menus, sliders, etc.) for building in-game UI on top of the engine.

**`server/`** exposes an `Engine` class ([server/src/index.ts](./server/src/index.ts)) that owns:
- **`GameLoop`** ([server/src/GameLoop.ts](./server/src/GameLoop.ts)) — a fixed-timestep tick loop (TPS-capped, with an optional `turbo` mode that ticks as fast as the event loop allows) that emits `tick` events and runs registered timers, driving every room.
- **Rooms** — a [`GameRoom`](./server/src/room.ts) per match: a `World` subclass with an invite code (which doubles as its pub/sub topic) and the set of entities a connection is driving. All ticked by the one loop, each running its own phases. A room is the authority for the clients mirroring it, so it records what spawns and what dies and can write that out as a frame.

**`shared/`** has no runtime behavior of its own — it's the layer both sides import from by relative path today (the root `phoenix.engine` export point is reserved for it and is still being filled in as the public surface stabilizes). It contains:
- **Entities** — [`Entity`](./shared/world/entity.ts) is identity and lifetime: an id, a spawn time, `update`/`onSpawn`/`onDestroy`. That is all `shared/` has, because that is where the two sides stop meaning the same thing. Each side then exports its own chain over the top — `Entity` -> `PositionEntity` (an `ObservableVector3` position) -> `MovingEntity` (a `Vector3` velocity, integrated per tick) — and they differ in exactly the half of the wire they carry: the server's [`serialize`/`serializeUpdate`/`isDirty`](./server/src/world/entity.ts), the client's [`deserialize`/`deserializeUpdate`](./client/src/world/entity.ts). An authority never reads entities and a mirror never writes them, so neither side carries the other's half. `import { PositionEntity } from "phoenix.engine/server"` gets the one that writes; the same line against `/client` gets the one that reads. The vectors mutate in place, so an entity carries the whole of `shared/libs/math/vector3D` — distance, normalize, dot, cross, rotate, interpolate — without allocating in a tick; and `position.hasUpdated(delta)` / `position.store()` is how the server asks what actually moved. A box, a crate, a player are the *game's* classes, one per side; behaviour goes in the entity's own `update`. There is no component registry and no render system — an entity that draws itself adds its mesh to the scene in `onSpawn` and takes it out in `onDestroy`.
- **World** — [`World`](./shared/world/world.ts) is the container and the tick: it holds the entities, hands out ids, emits `spawn`/`destroy`, and `world.update(dt)` runs the whole frame. Lookup by kind is `world.each(Player, ...)` / `all` / `first` / `count`, filtered by `instanceof`. Work that isn't one entity's business subscribes with `world.onUpdate(fn, { phase, priority })` and gets an unsubscribe back — no base class to extend and no registry. Phases are Input, PreUpdate, Update, PostUpdate, Network, Render; the entities themselves run at Update. Putting a world on a wire splits the same way its entities do: [`frame`/`clean`](./server/src/world/world.ts) on the server's World, [`sync`](./client/src/world/world.ts) on the client's.
- **Entity registry** — [`defineEntities`](./shared/world/registry.ts) names a game's entity kinds, and each side maps the same names onto its own classes: `{ player: Player }` on the server, `{ player: RenderedPlayer }` on the client. A name is what survives a network, so it is what the two sides agree on — never a class. That makes `world.spawn("player", socket.id)` typed off the declaration, and it is what a wire frame carries instead of a class.
- **Replication** — with a registry, a world puts itself on a wire, one frame per socket. The room remembers which entities each socket has; `room.frame(socket, visible)` writes what it needs to catch up with `visible` — despawns for what left view or died, spawns for what came into view, updates for what it has that changed — and returns nothing when that is nothing. Which entities are visible is the game's call (everything, a chunk, a view cone), and a socket that just joined has nothing, so its first frame spawns all it can see. Each entity is encoded once per tick into one buffer, and every frame copies its bytes from there. `room.clean()` then counts the changes as sent; `world.sync(reader)` applies a frame at the other end. What is *in* an entity's bytes is the entity's own business — it overrides `serialize`/`deserialize` for its spawn state and `serializeUpdate`/`deserializeUpdate`/`isDirty` for what changes — so adding a kind with a field of its own changes no protocol and no schema. A mirror world spawns replicated entities under the authority's ids and gives its own local ones negative ids, so the two can never collide.
- **Networking protocol** — the typed wire contract ([shared/networking/protocol.ts](./shared/networking/protocol.ts)): each side declares its `in`/`out` event lists and [BinarySchema](https://github.com/nasselk/BinarySchema) payload schemas, and `send`/`onMessage` are typed by them. Session tickets and routes are in [session.ts](./shared/networking/session.ts).
- **Math** — vectors, angles, polygons, interpolation and animation helpers ([shared/libs/math](./shared/libs/math)).
- **Utilities** — `EventEmitter`, logger, timers (`Timer`/`Interval`/`Timeout`/tick), `IDAllocator`, bitset, and text validation ([shared/utils](./shared/utils)).

## Peer dependencies

The engine does not bundle its rendering or UI dependencies — they're declared as [`peerDependencies`](./package.json), so the game provides a single copy of each:

| Package | Used for | Required |
| --- | --- | --- |
| [`three`](https://threejs.org/) `^0.185.1` | The renderer | Always |
| [`svelte`](https://svelte.dev/) `^5.0.0` | The bundled UI component kit | Only when using a component from `client/UI` |

## Installation

This package is private and not published to a registry, so consuming projects install it directly from the repository, alongside its peer dependencies:

```pwsh
bun add github:nasselk/Phoenix.Engine
bun add three
bun add svelte    # if using the bundled UI kit
```

Requires Node.js `>=22.0.0 <23.0.0` or `>=24.0.0` (see [`engines`](./package.json)) at runtime, and [Bun](https://bun.sh/) to install and build.

## Usage

Each subpath resolves to that workspace's built output (`dist/<workspace>`, with generated `.d.ts` files), as declared in the `exports` map.

**Client**, in a browser bundle:

```ts
import { defineEntities, Engine, PositionEntity } from "phoenix.engine/client";
import { BoxGeometry, Mesh, MeshLambertMaterial } from "three";

// What a `crate` is *on this side*: a mesh. The server's crate is a different class entirely.
class Crate extends PositionEntity {
	private readonly mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: 0xe74c3c }));

	public override onSpawn(): void {
		this.group.add(this.mesh); // `group` is the scene container the world hands every entity
	}

	public override render(): void {
		const { x, y, z } = this.position;

		this.mesh.position.set(x, y, z);
	}

	public override onDestroy(): void {
		this.group.remove(this.mesh);
	}
}

// The server's entity kinds, mapped onto the classes that draw them here.
const entities = defineEntities({ crate: Crate });

const engine = new Engine({ world: { entities } });

document.body.appendChild(engine.renderer.view);

await engine.init();

engine.world.spawn("crate", { y: 0.5 });

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

// Each socket gets its own frame: what it can see that spawned, moved or died, written by the entities themselves.
room.on("update", () => {
	for (const socket of room.sockets) {
		const frame = room.frame(socket, room.entities.values());

		if (frame !== undefined) {
			socket.send("sync", frame);
		}
	}

	room.clean();
});

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
