import { credit, log } from "../../shared/utils/logger";
import type { SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions } from "../../shared/world/registry";
import { World, type WorldRoleless } from "./world/world";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import { PixiRenderer } from "./rendering/lib/2D/2D";
import { ThreeRenderer } from "./rendering/lib/3D/Renderer";
import { GameLoop, type GameLoopParams } from "./GameLoop";
import { AudioSystem } from "./audio/AudioSystem";
import { InputSystem, type InputSystemOptions } from "./controls/InputSystem";
import { RendererKind } from "./rendering/RenderSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";

// The whole isomorphic surface, so a game that only has a client imports from one place.
export * from "../../shared/index";
// The client's own object model, exported over the shared one: an entity that can read itself and
// a world that can apply a frame. `import { Entity } from "phoenix.engine/client"` is this one.
export { Entity } from "./world/entity";
export { MovingEntity, STOP_SPEED } from "./world/moving";
export { PositionEntity, type PositionEntityOptions } from "./world/position";
export { World, type ClientWorldOptions, type WorldRoleless } from "./world/world";
// Client-only pieces a game builds on: the render backends, the built-in render system, and the
// subsystems whose types appear in EngineOptions.
export { AudioSystem, type AudioOptions } from "./audio/AudioSystem";
export { InputSystem, type ActionCallback, type InputSystemOptions } from "./controls/InputSystem";
export { GameLoop, type GameLoopParams } from "./GameLoop";
export { NetworkState, NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
export { RenderSystem, type RendererKind } from "./rendering/RenderSystem";
export { Camera } from "./rendering/lib/2D/camera";
export { PixiRenderer } from "./rendering/lib/2D/2D";
export { ThreeRenderer } from "./rendering/lib/3D/Renderer";
export { OrbitCamera, type OrbitCameraOptions, type OrbitTarget } from "./rendering/lib/3D/Camera";
export { storage, setStorage } from "./utils/storage";
export { EditorView } from "./rendering/lib/3D/editor/EditorView";

type EngineEvents = {
	init: [];
	destroy: [];
};

/**
 * Ceiling on live entities in the one world a client simulates. Mirrors the
 * server's per-room default, since a client only ever holds one room's worth.
 */
export const DEFAULT_CAPACITY = 5_000;

/** Everything the engine is handed: which renderer to build, and optionally the world, networking and inputs to bring up with it. */
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, Actions extends readonly string[] = [], R extends RendererKind = RendererKind, D extends EntityDefinitions = EntityDefinitions, C = unknown> = {
	readonly renderer: R;
	/** `context` is what every entity sees as `this.context`; left out, it is the engine. */
	readonly world?: WorldRoleless<D, C>;
	readonly loop?: Partial<GameLoopParams>;
	readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
	readonly inputs?: InputSystemOptions<Actions>;
};

export class Engine<
	const In extends readonly string[] = [],
	const Out extends readonly string[] = [],
	InSchemas extends SchemasFor<InSchemas, In> = {},
	OutSchemas extends SchemasFor<OutSchemas, Out> = {},
	const Actions extends readonly string[] = [],
	R extends RendererKind = RendererKind,
	const D extends EntityDefinitions = EntityDefinitions,
	C = unknown,
> extends EventEmitter<EngineEvents> {
	public readonly renderer: R extends "2D" ? PixiRenderer : ThreeRenderer;
	public readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
	public readonly loop: GameLoop;
	public readonly audio: AudioSystem;
	public readonly inputs: InputSystem<Actions>;
	public readonly world: World<D, C>;

	public constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, Actions, R, D, C>) {
		super();

		const world = options.world;

		this.renderer = new (options.renderer === "2D" ? PixiRenderer : ThreeRenderer)() as R extends "2D" ? PixiRenderer : ThreeRenderer;
		this.network = new NetworkSystem<In, Out, InSchemas, OutSchemas>(options.network);
		this.inputs = new InputSystem<Actions>(options.inputs);
		this.loop = new GameLoop(options.loop);
		this.audio = new AudioSystem();
		this.world = new World<D, C>({ ...world, context: (world?.context ?? this) as C, group: world?.group ?? this.renderer.world, capacity: world?.capacity ?? DEFAULT_CAPACITY, role: world?.entities === undefined ? "local" : "mirror" });
	}

	/**
	 * Initializes the engine, including the renderer, audio system, and any additional promises passed in.
	 *
	 * @param promise Optional promise to await before completing initialization.
	 *
	 * @returns A promise that resolves when the engine is initialized and ready to use.
	 */
	public async init(...promises: Promise<void>[]): Promise<void> {
		credit("Client");

		log("Phoenix Client", "Initializing the engine...");

		const renderer = this.renderer.init({
			antialiasing: true,
			backgroundColor: 0x000000,
			resolution: 1,
		});

		const audio = this.audio.init();

		this.inputs.init();

		// The world first, then the draw, so the renderer sees this frame's positions.
		this.loop.on("frame", (deltaTime, now) => {
			this.world.update(deltaTime);
			this.renderer.render(deltaTime, now);
		});

		await Promise.all([renderer, audio, ...promises]);

		this.loop.resume();

		log("Phoenix Client", "Successfully initiated the engine");

		this.emit("init");
	}

	/**
	 * Destroys the engine, including the renderer, audio system, network system, input system, and any event emitters.
	 */
	public destroy(): void {
		this.network.destroy();
		this.inputs.destroy();
		this.loop.destroy();
		this.world.dispose();
		this.audio.destroy();
		this.renderer.destroy();

		this.emit("destroy");

		this.removeAllListeners();
	}
}
