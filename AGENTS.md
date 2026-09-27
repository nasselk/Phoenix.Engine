# AGENTS.md

Rules for working on the engine. The [README](./README.md) is the API reference: read "How it works" before a first change. Games are built on the [template](https://github.com/nasselk/Phoenix.Engine-Template), which has its own AGENTS.md for game code.

## What this is

A library, not an application: games install it from GitHub and run its built `dist/`. It provides mechanisms (rooms, physics, replication, a typed binary protocol, rendering, input, audio, assets, UI components); games decide rules, visibility, controls and UI. The server is authoritative; clients mirror it.

## Layout

| Folder | Entry point | Runs on |
| --- | --- | --- |
| `shared/` | `phoenix.engine` | both: world and entity bases, math (`Vector3`, `Quaternion`, `Interpolator`), protocol, physics loading, utilities |
| `server/src/` | `phoenix.engine/server` | Bun: `Engine`, `World` (a room), writing entities, `NetworkSystem`, `GameLoop`, replication |
| `client/src/` | `phoenix.engine/client` | browser: `Engine`, `World` (a mirror), reading entities, rendering, cameras, input, audio, assets, editor |
| `client/UI/components/` | `phoenix.engine/ui/*.svelte` | browser: `Joystick`, `GridLayout` |
| `tests/` | — | Bun's test runner, against the source |

Each side's entry point re-exports everything shared. Anything a game should use must be exported from the right `index.ts`.

## Commands

```sh
bun run build         # compile client and server into dist/
bun run test          # engine tests (tests/)
bun run types:check   # typecheck client, server and tests
bun run format        # Biome
```

**Before calling any change done:** `bun run types:check` and `bun run test` pass, and `bun run build` succeeds. Behaviour an engine change adds or fixes gets a test in `tests/`.

## Releasing a change

`dist/` is committed, because nothing builds the engine when a game installs it.

1. `rm -rf dist && bun run build`, so moved or deleted files leave no stale copies.
2. Test, typecheck, commit and push.
3. In the game: `bun update phoenix.engine`, then **restart its dev servers** (they do not reload `node_modules`), then its own `types:check` and tests.

Every runtime dependency of `dist/` goes in the **root** `package.json` (the workspaces' own are ignored by installers), and so do the `@types` packages of any library in the public `.d.ts` files.

## Rules

**Boundaries**
- Mechanisms, not rules. Room codes, visibility, controls, UI and gameplay belong to games. Something every game would need belongs here.
- Rapier (`@dimforge/rapier3d-simd-compat`), three.js and Svelte are **peer dependencies**, imported directly by games. Never re-export them, never add a second Rapier package: two copies of Rapier crash.
- Changing a public API means updating the README, and the template if it uses it.

**Object model**
- Game objects are class hierarchies (`Entity` → `PositionEntity` → `MovingEntity`) with their own `update`. **No ECS.**
- Whatever a class starts, its `destroy` stops. Rooms free their Rapier world on `destroy`; nothing may touch a room after `destroyRoom`.

**The wire**
- The server entity writes, the client entity reads: the same fields in the same order, `super` first. Changing `PositionEntity`'s serialization (or any shared base's) changes every game's protocol: say so, since games must bump their `gameVersion`.
- Nothing on the wire that did not change: an entity is dirty only past its epsilon, each entity is encoded once per tick, a still room sends nothing.
- Rotations are quaternions: `ObservableQuaternion` on the server, `Quaternion` slerped on the client, packed into 4 bytes. `q` and `-q` are the same rotation; compare with `angleTo`, never component by component.
- Quantise with `BufferWriter.toPrecision` / `BufferReader.fromPrecision` and `wrap`.

**Performance**
- No allocation in per-tick or per-frame code: reuse static scratch objects.
- Only touch a Rapier body when something changed, so bodies at rest sleep.

## Code style

- TypeScript, strict. Tabs, double quotes, Biome (320 columns). Explicit `public`/`private`/`protected`, `readonly` wherever a field is not reassigned, `override` on overrides.
- **No prose comments** explaining what code does. A short doc comment on a public member is fine when its name cannot say it. Keep existing comments.
- **Reuse before writing**: search `shared/` for a helper (`clamp`, `wrap`, `toPrecision`, `Quaternion`, `Interpolator`, `get`/`post`) before adding one.
- **Type logic belongs at its own level.** Ask whether a file should know about a type before optimising how it is written.
- TypeScript 7 (`tsgo`) runs `types:check`; editors often run TypeScript 5.x. They can disagree on deep generic instantiation (TS2589); public types must pass both.
- Measure before stating a number (a precision, a speed, a limit) in code, docs or tests.
