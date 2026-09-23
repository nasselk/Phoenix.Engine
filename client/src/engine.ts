import { credit, log } from "../../shared/utils/logger";
import type { SchemasFor } from "../../shared/networking/protocol";
import type { EntityDefinitions } from "../../shared/world/registry";
import { type ClientWorldOptions, World } from "./world/world";
import { NetworkSystem, type NetworkSystemOptions } from "./networking/NetworkSystem";
import { RenderSystem, type RenderSystemOptions } from "./rendering/RenderSystem";
import { GameLoop, type GameLoopParams } from "./GameLoop";
import { AudioSystem, type AudioOptions } from "./audio/AudioSystem";
import { InputSystem, type InputSystemOptions } from "./controls/InputSystem";
import { EventEmitter } from "../../shared/utils/EventEmitter";
import { AssetManager, type AssetManagerOptions } from "./assets/AssetManager";
import { native, type NativeOptions } from "./native";
import { isMobileDevice } from "./utils/mobile";

type EngineEvents = {
	init: [];
	destroy: [];
};

/** Everything the engine is handed: the world, and optionally the loop, networking and inputs to bring up with it. */
export type EngineOptions<In extends readonly string[] = [], Out extends readonly string[] = [], InSchemas = {}, OutSchemas = {}, Action extends string = never, D extends EntityDefinitions = EntityDefinitions, C = never> = {
	readonly world: ClientWorldOptions<D, C>;
	readonly loop?: Partial<GameLoopParams>;
	readonly network?: NetworkSystemOptions<In, Out, InSchemas, OutSchemas>;
	readonly inputs?: InputSystemOptions<Action>;
	readonly assets?: AssetManagerOptions;
	/** How the canvas is set up: its resolution, its backdrop, and the three.js parameters behind it. */
	readonly renderer?: RenderSystemOptions;
	readonly audio?: Partial<AudioOptions>;
	/**
	 * Make the page behave like an application rather than a document: no context menu, no zooming,
	 * nothing dragged out of it. On unless a game says otherwise, and undone by `destroy`. The half
	 * of it that is styling is "phoenix.engine/native.css", which the game imports itself.
	 */
	readonly native?: boolean | NativeOptions;
};

type ContextOf<C, Self> = [C] extends [never] ? Self : C;

export class Engine<
	const In extends readonly string[] = [],
	const Out extends readonly string[] = [],
	InSchemas extends SchemasFor<InSchemas, In> = {},
	OutSchemas extends SchemasFor<OutSchemas, Out> = {},
	const Action extends string = never,
	const D extends EntityDefinitions = EntityDefinitions,
	C = never,
> extends EventEmitter<EngineEvents> {
	public readonly renderer: RenderSystem;
	public readonly assets: AssetManager;
	public readonly network: NetworkSystem<In, Out, InSchemas, OutSchemas>;
	public readonly loop: GameLoop;
	public readonly audio: AudioSystem;
	public readonly inputs: InputSystem<Action>;
	public readonly world: World<D, ContextOf<C, this>>;
	public readonly isMobile: boolean;

	/** Kept from the options until `init`, which is when there is a canvas and a context to apply them to. */
	private readonly rendering: RenderSystemOptions;
	private readonly sound: Partial<AudioOptions>;

	private readonly ordinary?: () => void;

	public constructor(options: EngineOptions<In, Out, InSchemas, OutSchemas, Action, D, C>) {
		super();

		const world = options.world;

		// Before anything is on screen, so a first right click or pinch is already ours.
		if (options.native !== false) {
			this.ordinary = native(options.native === true ? undefined : options.native);
		}

		this.isMobile = isMobileDevice().any;
		this.rendering = options.renderer ?? {};
		this.sound = options.audio ?? {};

		this.loop = new GameLoop(options.loop);
		this.renderer = new RenderSystem(undefined, this.isMobile);
		this.assets = new AssetManager(options.assets);
		this.network = new NetworkSystem<In, Out, InSchemas, OutSchemas>(options.network);
		this.inputs = new InputSystem<Action>(options.inputs);
		this.audio = new AudioSystem(this.assets);
		this.world = new World<D, ContextOf<C, this>>({ ...world, context: (world.context ?? this) as ContextOf<C, this> });

		this.renderer.scene.add(this.world.group);
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

		// The game's own over the defaults, `three` included: antialiasing is chosen when the context is
		// made, so unlike the resolution it cannot be changed later.
		const renderer = this.renderer
			.init({
				backgroundColor: 0x000000,
				resolution: 1,
				...this.rendering,
				three: { antialias: true, ...this.rendering.three },
			})
			.then((three) => this.assets.init(three));

		const audio = this.audio.init(this.sound);

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
		this.world.destroy();
		this.audio.destroy();
		this.assets.destroy();
		this.renderer.destroy();
		this.ordinary?.();

		this.emit("destroy");

		this.removeAllListeners();
	}
}
