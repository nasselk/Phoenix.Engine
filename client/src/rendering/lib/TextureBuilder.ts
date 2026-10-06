import { SRGBColorSpace, Texture } from "three";
import { AssetCache } from "../../assets/AssetCache";

export class TextureBuilder {
	private readonly canvas: OffscreenCanvas;
	private readonly context: OffscreenCanvasRenderingContext2D;
	private readonly cache: AssetCache;

	public constructor(cache: AssetCache, width: number = 1, height: number = width) {
		this.canvas = new OffscreenCanvas(width, height);
		this.cache = cache;

		const ctx = this.canvas.getContext("2d");

		if (!ctx) {
			throw new Error("Failed to get 2D context for texture builder");
		}

		this.context = ctx;
	}

	public draw(callback: (context: OffscreenCanvasRenderingContext2D) => void, clear: boolean = true, width?: number, height: number | undefined = width): OffscreenCanvasRenderingContext2D {
		if (width && height) {
			this.resize(width, height);
		}

		if (clear) {
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

	public async save(name?: string): Promise<Texture> {
		const bitmap = await createImageBitmap(this.canvas, { imageOrientation: "flipY" });
		const texture = new Texture(bitmap);

		texture.flipY = false;
		texture.colorSpace = SRGBColorSpace;
		texture.needsUpdate = true;

		if (name) {
			texture.name = name;

			this.cache.set("texture", name, texture);
		}

		texture.addEventListener("dispose", () => bitmap.close());

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

	public resize(size: number): this;
	public resize(width: number, height: number): this;
	public resize(width: number = this.canvas.width, height: number = width ?? this.canvas.height): this {
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
