import { SRGBColorSpace, Texture } from "three";
export class TextureBuilder {
    constructor(cache, width = 1, height = width) {
        this.canvas = new OffscreenCanvas(width, height);
        this.cache = cache;
        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context for texture builder");
        }
        this.context = ctx;
    }
    draw(callback, clear = true, width, height = width) {
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
    async save(name) {
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
    async download(name) {
        const blob = await this.canvas.convertToBlob({ type: "image/png" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    resize(width = this.canvas.width, height = width ?? this.canvas.height) {
        this.canvas.width = width;
        this.canvas.height = height;
        return this;
    }
    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        return this;
    }
    get width() {
        return this.canvas.width;
    }
    get height() {
        return this.canvas.height;
    }
}
