# API.md

Everything Phoenix Engine exposes to a game, nested under where a game reaches it. **Read this before writing any helper, builder, loader, camera, input handler, math function or UI widget: if it is listed here, use it.** Game repositories have this file at `node_modules/phoenix.engine/API.md`, matching the installed engine version. How the pieces work together is in the [README](./README.md).

`engine.x.y` means the instance a game already has: **never construct a second one** of a system the engine owns (a renderer, a texture builder, an audio builder, an input system). Optional parameters are marked `?`. Events are listed as `on(name)` with their arguments.

## Common patterns: use these, do not rewrite them

| Need | Use |
| --- | --- |
| A texture drawn in code (gradient, label, pattern, noise) | `engine.renderer.textureBuilder.draw(ctx => …).save("name")` |
| A sound made in code (blip, chime, siren, splash) | `engine.audio.soundBuilder.tone(…).save("name")`, then `engine.audio.play("name")` |
| A material or geometry shared by many meshes | `engine.assets.cache.getOrCreate("material", "id", () => new …)` |
| A model, texture or sound file | `engine.assets.load(kind, id, url)` / `loadAll(manifest)`, then `get` or `instance(id)` |
| Many static meshes drawn cheaply | `engine.renderer.batcher.batch(root)` |
| Text in the 3D scene, a name tag | `new Text("…", { billboard: true })` from `phoenix.engine/text` |
| Something touching something (kill brick, checkpoint, coin, pad) | override `onTouch(other)` / `onTouchEnd(other)` on the server entity; a zone is a collider with `setSensor(true)` |
| A player acting on one thing (grab, buy, hit) | send the entity's `id`; the server checks it with `room.get(id, Kind)`. Never let each side pick the target |
| Keys and mouse buttons | `binds` option + `engine.inputs.onActionStart/isActionRunning` |
| A touch stick, a HUD layout | `Joystick`, `GridLayout` from `phoenix.engine/ui/*.svelte` |
| Following an entity with the camera | `engine.renderer.camera.target = entity.position` |
| Smoothing, easing, tweens | `Interpolator.lerp/lerpAngle/lerpVector/slerpQuaternion/tween*`; an entity's own motion in `updatePosition`/`updateRotation` |
| Angles | `angleDistance`, `signedAngleDistance`, `normalizeAnglePI`, `wrap`; turn toward a point with `entity.yaw = position.azimuthTo(target)` |
| What is near a player (interest management, AoE, proximity) | `SpatialGrid`: `insert`/`update`/`remove`, then `query(center, radius, out)` |
| Packing a small number into a few bits | `BufferWriter.toPrecision` / `BufferReader.fromPrecision` |
| Delays, repeats | `wait`, `Timeout`, `Interval` |
| Events on your own class | `extends EventEmitter<{ name: [args] }>` |
| HTTP JSON with retries | `get`/`post`/`put`/`del` |
| Player text (names, chat) | `normalizeText`, `validateText`, `censorText` |
| Saved settings | `storage` (falls back to `sessionStorage`, then memory) |
| Phone or desktop | `engine.isMobile`, `isMobileDevice()` |
| Debug overlay (grid, FPS, ping, free camera, wireframe) | `new EditorView(engine)` |

## `phoenix.engine/client`

```
Engine<In, Out, InSchemas, OutSchemas, Action, D, C>        new Engine(options), one per page
├─ options: world { entities, context?, capacity? }, network? { in, out, simulation? { latency, loss } },
│           inputs? { binds }, loop? { FPS, speed },
│           assets? (AssetManagerOptions), renderer? (RendererSettings), audio? { globalVolume, muteInitial },
│           native? (true | { target, contextMenu, zoom, drag, viewport })
├─ init(...promises)            builds renderer, audio, inputs, starts the loop; awaits the extra promises too
├─ destroy()
├─ isMobile                      true → TouchCamera, false → DesktopCamera
├─ each frame: world.update(dt) → renderer "render" event → camera.update(dt) → draw
├─ on("init" | "destroy")
│
├─ renderer: RenderSystem
│  ├─ scene: three.Scene                     add your objects here (entities add their own group)
│  ├─ camera: OrbitCamera                    DesktopCamera or TouchCamera
│  │  ├─ target?: {x,y,z}                    what it orbits; assign an entity's position to follow it
│  │  ├─ yaw, pitch, distance                min/maxPitch, min/maxDistance
│  │  ├─ turn (-1…1), turnSpeed; tilt (-1…1), tiltSpeed   turn and tilt every frame, from the game's actions or a stick
│  │  ├─ flyForward, flyRight (-1…1), flyBoost, flySpeed, boost   fly a detached camera every frame
│  │  │                                      the camera reads no keys: the game sets these from its actions
│  │  ├─ rotateSpeed, zoomSpeed, dragging, zooming, minZoom, maxZoom
│  │  ├─ verticalFov, minHorizontalFov       fov widens on narrow screens to keep minHorizontalFov
│  │  ├─ rotate(yaw, pitch), zoomBy(amount), pinchBy(ratio), setZoom(zoom)
│  │  ├─ detached (get/set)                  true flies free from where it is; false snaps back to orbiting
│  │  ├─ isOrbiting, fit(aspect?), update(dt?), connect(element?), destroy()
│  │  ├─ DesktopCamera: button (mouse drag turns it, wheel zooms)
│  │  └─ TouchCamera: pinchSpeed
│  ├─ textureBuilder: TextureBuilder         textures drawn on an OffscreenCanvas
│  │  ├─ draw(ctx => …, clear = true, width?, height?)   resets transform/alpha/styles, then calls you
│  │  ├─ save(name?) → Promise<Texture>      with a name, stored in assets.cache as "texture"
│  │  ├─ download(name)                      saves a .png
│  │  ├─ resize(size) / resize(w, h), clear(), width, height
│  ├─ batcher: Batcher
│  │  └─ batch(root) → BatchedMesh[]         static meshes under root → one BatchedMesh per material, in place
│  │                                         skips sprites, Text, invisible, userData.batch = false
│  ├─ internals: three.WebGLRenderer
│  ├─ view: HTMLCanvasElement                mount it: document.body.appendChild(engine.renderer.view)
│  ├─ resolution                             fraction of device pixels; call resize() after changing
│  ├─ resize(w?, h?), render(dt, now?), setFullscreen(b?), isFullscreen
│  ├─ visible, width, height, ready, initialized: RenderSystemState
│  └─ on("init" [canvas] | "render" [dt, now] | "resize" [w, h] | "destroy")
│                                            "render" fires after the world update, before camera.update and the draw
│
├─ assets: AssetManager
│  ├─ load(kind, id, source) → Promise       kinds: "model" (glTF url), "texture" (url), "sound" (SoundSource), or registered
│  │                                         SoundSource: a url, or { src, loop?, html5?, volume?, sprite?, … } (Howler options)
│  │                                         a loaded colour texture needs texture.colorSpace = SRGBColorSpace
│  │                                         a model keeps its glTF clips on model.animations
│  ├─ loadAll({ model: {id: url}, texture: {…}, sound: {…} })
│  ├─ get(kind, id), has(kind, id)
│  ├─ instance(id) → Object3D                a copy of a loaded model, sharing geometry and materials (and animations):
│  │                                         tinting one copy's material tints every copy; clone the material first
│  ├─ release(kind, id), clear(...kinds), destroy()
│  ├─ register(kind, { load, unload? })      a new kind; type it by augmenting AssetKinds
│  ├─ extendGLTF(plugin), init(renderer)     init is called by the engine
│  ├─ manager: three.LoadingManager
│  ├─ on("progress" [loaded, total] | "complete" | "load" [kind, id] | "error" [kind, id, error])
│  └─ cache: AssetCache                      everything shared, by kind and id
│     ├─ get(kind, id), has(kind, id), entries(kind)
│     ├─ set(kind, id, value)                frees what was under that id
│     ├─ getOrCreate(kind, id, () => value)  kinds: model, texture, material, geometry, sound, font
│     ├─ release(kind, id), clear(...kinds)
│     └─ setDisposer(kind, fn)
│
├─ audio: AudioSystem                        Howler underneath; unlocks on the first user gesture
│  ├─ play(id, sprite?) → playback id        a "sound" loaded or built under that id
│  ├─ pause(id?, playbackId?), stop(id?, playbackId?)   no id: every sound
│  ├─ volume (0…1), muted
│  ├─ on("init" | "play" | "pause" | "stop" [id, playbackId] | "mute" [b] | "volume" [v] | "destroy")
│  └─ soundBuilder: SoundBuilder             sounds synthesised in code, rendered once
│     ├─ tone(type, notes[], step, volume = 0.2, start = 0)        notes one after another
│     ├─ sweep(type, low, high, period, repeat = 1, volume = 0.12, start = 0)   siren
│     ├─ noise(duration, from = 1800, to = 200, volume = 0.3, start = 0)       low-passed noise
│     ├─ layer(end, (context, output) => …)                       any Web Audio nodes
│     ├─ save(name?) → Promise<Howl>          with a name, stored as "sound": engine.audio.play(name)
│     ├─ render() → AudioBuffer, download(name) (.wav), clear(), duration
│
├─ inputs: InputSystem<Action>               actions are the keys of the binds option
│  ├─ onActionStart(action, cb), onActionStop(action, cb) → unsubscribe
│  ├─ isActionRunning(action), isInputPressed(code)
│  ├─ mapActionToKeys(action, ...codes), unmapActionFromKeys(action, ...codes)
│  ├─ onPressInput(cb) → unsubscribe          every key press, for rebinding screens
│  ├─ isPrintableKey(event), init(element?), destroy()
│  └─ codes are physical: "KeyW", "Space", "ArrowUp", "Pointer0" (left mouse)…
│
├─ network: NetworkSystem<In, Out, …>
│  ├─ connect(url), disconnect(code?, reason?)  reconnects by itself after a dropped connection, as a new socket;
│  │                                         the world is not cleared: call engine.world.clear() on "reconnection"
│  │                                         before rejoining, or entities that died meanwhile stay
│  ├─ send(event, data?)                     typed by the out list and schemas
│  ├─ onMessage(event, data => …) → remove   typed by the in list and schemas; no schema → BufferReader
│  │                                         one handler per event: a second throws until the first is removed
│  ├─ simulate(event, data)                  feed a message locally, for tests and offline play
│  ├─ latency, loss                          simulated lag (ms) and loss (0…1)
│  ├─ stats { in, out: { bps, mps }, latency }, readyState: NetworkState, buffered, protocol
│  │                                         latency: the engine pings the server once a second, no game event needed
│  └─ on("connection" | "disconnection" [code, reason, manual] | "reconnection" | "message" [event, reader] | "stats" [stats])
│
├─ loop: GameLoop
│  ├─ maxFrameRate, speed, frameID, paused, pause(), resume()
│  ├─ stats { FPS, low99, frames { global, cpu, gpu } }
│  └─ on("frameStart" [now] | "frame" [dt, now] | "frameEnd" [frameTime, now] | "stats" | "pause" | "resume" | "destroy")
│
└─ world: World<D, C>                        the mirror of the server's room (see "Worlds" below)
   ├─ sync(reader)                           apply a frame: engine.network.onMessage("sync", r => engine.world.sync(r))
   ├─ spawn(kind, options?)                  local-only entity, negative id, never on the wire
   ├─ group: three.Group                     every entity's group lives under it
   ├─ serverTime                             the room's time at the last frame applied, in seconds
   └─ framesReceived                         frames applied so far; the editor's TPS panel is their rate
```

Client entities (extend them, one class per kind):

```
Entity<C>                                    abstract
├─ id, kind, type, alive, spawnTime, age, world, context   reserved: never reuse these names in a subclass
├─ update(dt), render(dt)                    render is yours to call; the engine never does
├─ deserialize(reader), deserializeUpdate(reader)   super first, mirror of the server's serialize
├─ onSpawn(), onDestroy(), destroy()
└─ PositionEntity<C>
   ├─ group: three.Group                     put your meshes here; placed at position/rotation every frame
   ├─ position, targetPosition: Vector3      what is shown, and what the server last said
   ├─ rotation, targetRotation: Quaternion
   ├─ yaw                                    which way it faces
   ├─ updatePosition(dt), updateRotation(dt) protected; bring position/rotation to the target each frame. Default: jump to it. Override to interpolate
   ├─ teleport(x, y, z) / teleport(vector)   set both position and targetPosition
   └─ MovingEntity<C>                        same as PositionEntity on the client
```

Also exported: `OrbitCamera`, `OrbitCameraOptions`, `OrbitTarget`, `DesktopCamera`, `DesktopCameraOptions`, `TouchCamera`, `TouchCameraOptions`, `EditorView`, `EditorViewOptions`, `RenderSystem`, `RenderSystemState`, `RendererSettings`, `AssetManager`, `AssetCache`, `AssetKind`, `AssetKinds`, `AssetLoader`, `AssetManagerOptions`, `AssetManifest`, `AssetSource`, `AssetSources`, `SoundSource`, `AudioSystem`, `AudioOptions`, `SoundBuilder`, `SoundLayer`, `encodeWav(pcm)` → WAV bytes, `PCMSource`, `InputSystem`, `InputSystemOptions`, `ActionCallback`, `NetworkSystem`, `NetworkSystemOptions`, `NetworkState`, `NetworkStats`, `NetworkChannelStats`, `GameLoop`, `GameLoopParams`, `LoopStats`, `ClientWorldOptions`, `PositionEntityOptions` (`x y z pitch yaw roll`), `MovingEntityOptions`, `EngineOptions`, and:

```
EditorView extends three.Group               new EditorView(engine, { plane?, grid?, axes? }); add it to the scene
├─ init(selector)                            mounts FPS / ms / memory / ping / bandwidth / TPS panels in that element
│                                            TPS: server frames received per second, 0 while the room is still
├─ toggleCamera(attach?)  (F)                free fly camera
├─ toggleWireframe(on?)   (V)
├─ plane, grid, axes, stats, destroy()
storage                                      localStorage, else sessionStorage, else memory, whichever is reachable; setStorage(replacement)
isMobileDevice() → { mobile, tablet, any }   DeviceType
```

## `phoenix.engine/server`

```
Engine<In, Out, InSchemas, OutSchemas, D, C>                new Engine(options), one per process
├─ options: entities (defineEntities), context?, network?, loop? { TPS, turbo, speed }, rooms? { maximum }
├─ init()                                    loads Rapier, opens the port, starts ticking
├─ destroy()
├─ createRoom({ maxPlayers?, capacity?, public = true, inviteCode? }) → World     RoomOptions
├─ getRoom(code), destroyRoom(code), rooms: Map<code, World>
├─ Room                                     type only: this engine's room type, `typeof engine.Room` or `MyEngine["Room"]`
├─ fullestRoom(...excludeCodes)              public room with the most players and a free seat
├─ occupancy() → { [code]: { players, maxPlayers, public } }   private codes included: never serve it
├─ on("init" | "destroy")
│
├─ network: NetworkSystem
│  ├─ options: in, out, limits { [event]: { maxRate, byteLength } }, port, origins, TLS, proxied, http, ws
│  ├─ onMessage(event, (socket, data) => …) → remove   one handler per event: a second throws
│  ├─ broadcast(topic, event, data?)
│  ├─ route(path, request => Response)       extra GET routes, before init; request.params
│  ├─ built-in routes: GET /ws (origin and rate checked), GET /infos { players, maxPlayers, uptime },
│  │                   GET /ping, GET /rooms/:code { players, maxPlayers, public } or 404
│  ├─ sockets: Map<id, Socket>, IPList, settings, protocol, init(), destroy()
│  └─ on("listening" [port] | "connection" [socket] | "disconnection" [socket, code, reason] | "message" [socket, event, data] | "destroy")
│
└─ loop: GameLoop
   ├─ maxTickRate, turbo, speed, tickID, lastTickTime, paused, pause(), resume()
   ├─ fixed ticks: dt is always 1 / TPS × speed; behind, it catches up (≤ 0.1 s of ticks in a row) and drops the rest
   ├─ stats { TPS, low99, ticks, mspt, memory { total, heap, arraybuffer } }
   └─ on("tickStart" [now] | "tick" [dt, now] | "tickEnd" [tickTime, now] | "stats" | "pause" | "resume" | "destroy")

World (a room)                               engine.createRoom(); shares the query API below
├─ inviteCode, maxPlayers, public, sockets: Set<Socket>, destroyed
├─ physics: RAPIER.World                     gravity GRAVITY, stepped once a tick
├─ bodies: Set<PositionEntity>               entities with a body
├─ spawn(kind, options?)                     typed by the registry; throws when full
├─ join(socket) → boolean, leave(socket) → boolean
├─ frame(socket, visibleEntities) → bytes | undefined   what this socket must learn; send it as "sync"
├─ clean()                                   after every socket got its frame this tick
├─ broadcast(event, data?)                   to every socket in the room
├─ update(dt), destroy()
└─ on("update" [dt])                         after the physics step: send frames here

Socket
├─ id, ip, room?, data: SocketData   augment SocketData for your per-player fields
├─ send(event, data?), broadcast(topic, event, data?), cork(socket => …)
├─ subscribe(topic), unsubscribe(topic)
├─ disconnect(reason?, code?)                with a close frame; terminate() cuts it at once
├─ readyState: SocketState
├─ lastMessage, messages, rates, seen, resetRates(), disconnection(code, reason)
└─ on("disconnection" [code, reason, manual] | "message" [event, data])
```

Server entities:

```
Entity<C>                                    abstract
├─ id, kind, type, alive, spawnTime, age, world, context, slot   reserved: never reuse these names in a subclass
├─ update(dt)
├─ serialize(writer), serializeUpdate(writer)   super first
├─ isDirty, clean()                          dirty only when something on the wire changed
├─ onSpawn(), onDestroy(), destroy()
└─ PositionEntity<C>
   ├─ position: ObservableVector3, rotation: ObservableQuaternion
   ├─ yaw (get, set: stands it upright)      rotation.setFromEuler(pitch, yaw, roll) for the rest
   ├─ body?: RAPIER.RigidBody                body.userData is the entity
   ├─ embody(bodyDesc, ...colliderDescs)     protected; call in the constructor
   ├─ beforePhysics(), afterPhysics()        copy to and from the body around the step
   ├─ onTouch(other), onTouchEnd(other)      override to listen: once per entity pair, solid or sensor (setSensor(true)), after the step
   ├─ isTouching(other), touch(other, started)   touch is the room's call
   ├─ teleport(x, y, z) / teleport(vector)
   ├─ room                                   protected: the World it is in
   └─ MovingEntity<C>
      ├─ options: velocity { x, y, z }, gravityScale, damping
      └─ applyImpulse(x, y, z)
```

Also exported: `initPhysics()` (the engine calls it; for tests), `setExitListeners(source, onStop?)` (clean shutdown on signals), `POSITION_EPSILON`, `ROTATION_EPSILON`, `MAX_INVITE_CODE_ATTEMPTS`, `RoomOptions`, `DEFAULT_NETWORK_SETTINGS`, `NetworkSettings`, `NetworkSystemOptions`, `EventLimit`, `EventLimits`, `SocketState`, `SocketData`, `ServerWorldOptions`, `PositionEntityOptions`, `MovingEntityOptions`, `GameLoopParams`, `LoopStats`, `EngineOptions`.

## `phoenix.engine` (shared, re-exported by both sides)

```
Worlds (both sides)                          client World and server room
├─ get(id), get(id, "kind"), get(id, Class)
├─ has(id, kind?), each(kind, cb), all(kind) → [], count(kind)   kind is a name or a class
├─ clear(...kinds), destroy()
├─ entities: Map<id, Entity>, size, capacity, registry, time
└─ on("spawn" [entity] | "destroy" [entity] | "update" [dt])

SpatialGrid<T extends { position }>(cellSize)   what is near a point, without scanning everything
├─ insert(item), update(item) after it moved (cheap if it stayed in its cell), remove(item), has(item), clear(), size
└─ query(center, radius, out?) → T[]         everything within radius; reuse `out` and it allocates nothing
                                             interest management: room.frame(socket, grid.query(player.position, 60, visible))
Positioned

defineEntities({ name: Class, … }) → EntityRegistry      same names on both sides
EntityRegistry: names, size, has(name), code(name), kind(code), class(name), kindOf(entity),
                matches(entity, kind) (type guard), describe()
MAX_ENTITY_KINDS, Entity / World (the shared bases), EntityClass, EntityConstructor, EntityDefinitions, EntityOptions, WorldEvents, WorldOptions

Vector3 / ObservableVector3                  mutable, chainable; Vector2 / ObservableVector2 the same in 2D
├─ static NULL, TEMP1…TEMP5                  scratch vectors for hot paths
├─ set, add, subtract, multiply, divide (vector, scalar?) or (x, y, z), scale(s)
├─ setDirection / addDirection(azimuth, elevation, distance), interpolate(v, t)
│                                            y-up: azimuth is the yaw facing the vector (0 → +z, π/2 → +x), elevation the angle above the ground
├─ dot, normalize, rotate(angle, axis, point?), reflect(normal)
├─ cross(v, out?), delta(v, out?) (this − v), midpoint(v, out?)   write into out; a new vector without it
├─ distance, distanceSquared, azimuthTo, elevationTo, segmentDistance(a, b)
├─ projectOnSegment(a, b, out?), project(direction, out?)
├─ magnitude (get/set), magnitudeSquared, azimuth, elevation, xyz, max, min, isNull, equals, clone, toString
└─ Observable: store(x?, y?, z?), storeX/Y/Z, hasUpdated(delta?), hasUpdatedX/Y/Z
Quaternion / ObservableQuaternion
├─ static IDENTITY, TEMP1, TEMP2
├─ set, setFromEuler(pitch, yaw, roll), setFromYaw, setFromAxisAngle(axis, angle), toEuler(out?), yaw
├─ multiply, premultiply, invert, normalize, length, dot, slerp(target, t), angleTo, equals(q, eps?)
├─ pack() → u32, unpack(u32), clone
└─ Observable: store(), hasUpdated(minimumAngle?)
eulerToQuaternion(pitch, yaw, roll, out), quaternionToEuler(q, out)
Interpolator: lerp(start, end, factor, frames = 1, limit?), lerpAngle, lerpVector, slerpQuaternion, lerpColor (hex or rgba), clampedLerp,
              tween, tweenAngle, tweenVector, tweenColor (curve: InterpolationCurve.LINEAR | EASE_IN | EASE_OUT | EASE_IN_OUT)
clamp(v, min, max), wrap(v, min, max)
angleDistance, signedAngleDistance, normalizeAnglePI, normalizeAngle2PI, closestAngle(ref, ...angles),
getOppositeAngle, degreesToRadians, radiansToDegrees      normalizeAnglePI returns [-π, π), normalizeAngle2PI [0, 2π)
              factor is the share of the gap closed per frame; pass frames = deltaTime * 60 for frame-rate independence
randomInt, randomFloat, randomAngle, randomBoolean(w1?, w2?, random?), randomElement(array, random?),
weightedRandom(weights[], random?) → index   every helper takes an optional random source, for seeded runs
wave(min, max, speed?, now?), syncedWave, pointsSyncedWave, fadeInHoldAndFadeOut
GRAVITY (-9.81), EPSILON

BufferWriter                                 writeUint8/16/32/64, writeInt8…64, writeFloat16/32/64, writeBits,
                                             writeBoolean, writeString, writeBuffer, bytes, reset
├─ static toPrecision(value, max, bits, signed?, min?)   a value in a range → an integer of `bits` bits
BufferReader                                 readUint8…, readInt8…, readFloat16/32/64, readBits, readBoolean, readString, readBuffer, remainingBytes
├─ static fromPrecision(int, max, bits, signed?, min?)   and back
Buffers                                      import buffers from phoenix.engine, never from @nasselk/binarypack: games do not install it
Event schemas: defineSchemas and FieldType from @nasselk/binaryschema, a peer dependency the game installs

Protocol, ProtocolChannel, MAX_EVENTS (255 per direction: code 255 is the engine's ping), Contract, ContractOf, Side, SchemasFor, InboundEvent, OutboundEvent,
InboundSchemas, OutboundSchemas, MessagePayload, SendPayload
INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH, RoomOccupancy

EventEmitter<{ event: [args] }>              on(e, cb) → unsubscribe, off, removeAllListeners, protected emit
Timeout(cb, delay), Interval(cb, delay)      Timer: pause, resume, reschedule, clear, elapsedTime, remainingTime, active
                                             paused time never counts; resume picks up with what remained
wait(ms) → Promise
IDAllocator: allocate, allocateNegative, free, freeWithTimeout, processTimeouts, clear
CounterMap<K>: increment, decrement, getCount, has, delete, outOfBounds, clear
get / post / put / del(baseURL, route, body?, settings?) → HTTPResponse<T> { success, data, error? }
                                             RequestSettings { params, timeout, tries, retryDelay, fetchOptions }, ResponseError
normalizeText, validateText(text, length | [min, max]), censorText
hex(0xff8800) → "#ff8800", hexToRgba, rgbaToHex, extractRGBA, isHexColor, isRGBA, getRandomColor
deepMerge, deepCopy, removeFromArray
log / warn / error(source, ...messages)
Timings, DeepImmutable, JsonValue, JsonObject, JsonArray, JsonPrimitive, Vector2Structure, Vector3Structure, QuaternionStructure
```

## `phoenix.engine/text`

```
Text extends three.Mesh                      new Text("Hello", { fontSize, color, anchorX: "center", billboard: true, … })
├─ text, font, fontSize, color, outlineWidth, outlineColor, maxWidth, textAlign, anchorX, anchorY, … (TextProperties)
├─ billboard                                 always faces the camera
├─ each Text is its own draw call and is never batched: hundreds of them cost hundreds of draws
├─ sync(cb?), destroy()
preloadFont(font?, characters?)              glyphs built ahead of time
fontLoader(characters?)                      engine.assets.register("font", fontLoader()); load("font", id, url)
configureText({ defaultFontURL, unicodeFontsURL, sdfGlyphSize, useWorker })   before the first text
TextConfig, TextOptions, TextProperties
```

## `phoenix.engine/ui/*.svelte` and `phoenix.engine/native.css`

```
Joystick.svelte      props: top, left, right, bottom, size, deadZone = 0.15, stickyZone?, fade?, class,
                            onstart(), onmove({ x, y, angle, distance }), onstop()
                     angle counter-clockwise from the right; distance 0…1 past the dead zone. Use them as they are.
                     CSS variables: --joystick-size, --joystick-base, --joystick-base-border, --joystick-blur,
                     --joystick-layer, --joystick-fade-time, --joystick-stick, --joystick-stick-size,
                     --joystick-stick-border, --joystick-stick-held, --joystick-return
                     (fallbacks read --ui-sunken, --ui-accent-fill, … when a game defines them)
GridLayout.svelte    full-screen 3 × 3 grid: snippets top_left … bottom_right, <slot>_direction "row" | "column"
                     (default "row" for the centre column, "column" for the sides),
                     padding, gap, id, class
native.css           import first: no selection, no overscroll, no tap highlight
```
