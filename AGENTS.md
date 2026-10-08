# AGENTS.md

Rules for working on the engine. The [API map](./API.md) lists everything it exposes. The [README](./README.md) explains how the pieces work together; read its "How it works" before a first change. Games are built on the [template](https://github.com/nasselk/Phoenix.Engine-Template), which has its own AGENTS.md for game code.

**Working on a game?** Read [API.md](./API.md) before writing any helper, builder, loader, camera, input handler, math function or UI widget. If it is listed there, use it. Game repositories have it at `node_modules/phoenix.engine/API.md`.

## What this is

A library, not an application: games install it from GitHub and run its built `dist/`. It provides mechanisms (rooms, physics, replication, a typed binary protocol, rendering, input, audio, assets, UI components); games decide rules, visibility, controls and UI. The server is authoritative; clients mirror it.

## Layout

| Folder | Entry point | Runs on |
| --- | --- | --- |
| `shared/` | `phoenix.engine` | both: world and entity bases, math (`Vector3`, `Quaternion`, `Interpolator`), protocol, physics loading, utilities |
| `server/src/` | `phoenix.engine/server` | Bun: `Engine`, `World` (a room), writing entities, `NetworkSystem`, `GameLoop`, replication |
| `client/src/` | `phoenix.engine/client` | browser: `Engine`, `World` (a mirror), reading entities, rendering, cameras, input, audio, assets, editor |
| `client/src/text/` | `phoenix.engine/text` | browser: `Text` (SDF text in the scene) |
| `client/UI/components/` | `phoenix.engine/ui/*.svelte` | browser: `Joystick`, `GridLayout` |
| `client/UI/native.css` | `phoenix.engine/native.css` | browser: app-like page styles |
| `tests/` | — | Bun's test runner, against the source |

Each side's entry point re-exports everything shared. Anything a game should use must be exported from the right `index.ts`, **and listed in [API.md](./API.md)** (`tests/api-map.test.ts` fails otherwise).

## Commands

```sh
bun run build         # compile client and server into dist/
bun run test          # engine tests (tests/)
bun run types:check   # typecheck client, server and tests
bun run format        # Biome
```

**Before calling any change done:** `bun run types:check` and `bun run test` pass, and `bun run build` succeeds. Behaviour an engine change adds or fixes gets a test in `tests/`.

## Tests

`tests/` mirrors the engine: `shared/`, `server/` and `client/`, one file per module (`server/replication.test.ts`, `shared/math.test.ts`), plus `api-map.test.ts`. Rooms, boxes, sockets and frame delivery come from `tests/fixtures.ts`; never build them again in a test file.

- One `describe` per public class or function, named after it. Each test name states a behaviour of that API ("a still world sends nothing after the first frame"), never the bug that led to it.
- Test the contracts games rely on and that break quietly: the wire, replication, physics sync, connections, input, timing, math. Not getters, not three.js or Rapier themselves.
- A fix gets a test only if no existing test would have caught it, and it goes in that module's file, usually as one more expectation in the test covering that behaviour.

## Releasing a change

`dist/` is committed, because nothing builds the engine when a game installs it.

1. `rm -rf dist && bun run build`, so moved or deleted files leave no stale copies.
2. Test, typecheck, commit and push.
3. In the game: `bun update phoenix.engine`, then **restart its dev servers** (they do not reload `node_modules`), then its own `types:check` and tests.

Every runtime dependency of `dist/` goes in the **root** `package.json` (the workspaces' own are ignored by installers), and so do the `@types` packages of any library in the public `.d.ts` files.

## Rules

**Boundaries**
- Mechanisms, not rules. Room codes, visibility, controls, UI and gameplay belong to games. Something every game would need belongs here.
- Rapier (`@dimforge/rapier3d-simd-compat`), three.js, Svelte and BinarySchema (`@nasselk/binaryschema`) are **peer dependencies**, imported directly by games. Never re-export them, never add a second Rapier package: two copies of Rapier crash.
- BinaryPack (`@nasselk/binarypack`) is the opposite: the engine's own dependency, re-exported from `phoenix.engine`, because the protocol creates buffers and checks `instanceof BufferWriter`. Games never install it.
- Changing a public API means updating the README, **[API.md](./API.md)**, and the template if it uses it.

**Object model**
- Game objects are class hierarchies (`Entity` → `PositionEntity` → `MovingEntity`) with their own `update`. **No ECS.**
- Whatever a class starts, its `destroy` stops. Rooms free their Rapier world on `destroy`; nothing may touch a room after `destroyRoom`.

**The wire**
- The server entity writes, the client entity reads: the same fields in the same order, `super` first. Changing `PositionEntity`'s serialization (or any shared base's) changes every game's protocol: say so, since games must bump their `gameVersion`.
- Nothing on the wire that did not change: an entity is dirty only past its epsilon, each entity is encoded once per tick, a still room sends nothing.
- Rotations are quaternions: `ObservableQuaternion` on the server, `Quaternion` slerped on the client, packed into 4 bytes. `q` and `-q` are the same rotation; compare with `angleTo`, never component by component.
- Quantise with `BufferWriter.toPrecision` / `BufferReader.fromPrecision` and `wrap`.

**Performance**
- No allocation in per-tick or per-frame code: reuse static scratch objects (`Vector3.TEMP1`…`TEMP5`, `Quaternion.TEMP1`/`TEMP2`, or a module-level one).
- Only touch a Rapier body when something changed, so bodies at rest sleep.

## Code style

- TypeScript, strict. Tabs, double quotes, Biome (320 columns). Explicit `public`/`private`/`protected`, `readonly` wherever a field is not reassigned, `override` on overrides.
- **No prose comments** explaining what code does. A short doc comment on a public member is fine when its name cannot say it. Keep existing comments.
- **Reuse before writing**: check [API.md](./API.md), then search `shared/`, before adding a helper.
- **Type logic belongs at its own level.** Ask whether a file should know about a type before optimising how it is written.
- TypeScript 7 (`tsgo`) runs `types:check`; editors often run TypeScript 5.x. They can disagree on deep generic instantiation (TS2589); public types must pass both.
- Measure before stating a number (a precision, a speed, a limit) in code, docs or tests.
