import { RenderSystem } from "./rendering/RenderingLoop";

export class Engine {
	public readonly renderer: RenderSystem;

	public constructor() {
		this.renderer = new RenderSystem();
	}

	public init(): void {}

	public destroy(): void {}
}
