import { CanvasTexture } from "three";

export class TextureBuilder {
	private readonly canvas: OffscreenCanvas;
	private readonly context: OffscreenCanvasRenderingContext2D;

	public constructor(width: number = 1, height: number = width) {
		this.canvas = new OffscreenCanvas(width, height);

		const ctx = this.canvas.getContext("2d");

		if (!ctx) {
			throw new Error("Failed to get 2D context for texture builder");
		}

		this.context = ctx;
	}

	public draw(callback: (context: OffscreenCanvasRenderingContext2D) => void, reset: boolean = true): OffscreenCanvasRenderingContext2D {
		if (reset) {
			this.context.resetTransform();
			this.context.scale(1, 1);
			this.context.rotate(0);
			this.context.globalAlpha = 1;
			this.context.fillStyle = "white";
			this.context.strokeStyle = "black";
			this.context.lineWidth = 1;

			this.clear();
		}

		callback(this.context);

		return this.context;
	}

	public save(name?: string): CanvasTexture<OffscreenCanvas> {
		const texture = new CanvasTexture(this.canvas);

		if (name) {
		}

		return texture;
	}

	public async download(name: string): Promise<void> {
		const blob = await this.canvas.convertToBlob({ type: "image/png" });

		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${name}.png`;
		a.click();

		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	public resize(width: number, height: number): this {
		this.canvas.width = width;
		this.canvas.height = height;

		return this;
	}

	public clear(): this {
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		return this;
	}

	public get width(): number {
		return this.canvas.width;
	}

	public get height(): number {
		return this.canvas.height;
	}
}
