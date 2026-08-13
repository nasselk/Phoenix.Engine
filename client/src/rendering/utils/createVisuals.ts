import { releaseTexture, retainTexture } from "@client/src/loaders/texture";
import { Sprite, Container, AnimatedSprite, Texture, Graphics, type SpriteOptions, type ContainerOptions, type AnimatedSpriteOptions, BitmapText, type TextOptions, type Ticker, DestroyOptions, AnimatedSpriteFrames } from "pixi.js";

export class DefaultContainer extends Container {
	public constructor(options?: ContainerOptions) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined; // Disable labels in production
		}

		super({
			eventMode: import.meta.env.DEV ? "static" : "none",
			...options,
		});
	}
}

export class DefaultSprite extends Sprite {
	public constructor(options?: SpriteOptions) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined; // Disable labels in production
		}

		super({
			texture: Texture.EMPTY, // Fallback texture
			anchor: 0.5, // Center anchor by default
			eventMode: import.meta.env.DEV ? "auto" : "none", // Disable events in production by default
			...options,
		});
	}

	public override get texture(): Texture {
		return super.texture;
	}

	public override set texture(texture: Texture) {
		const previous = super.texture;

		if (previous === texture) {
			return;
		}

		super.texture = texture;

		if (previous) {
			releaseTexture(previous);
		}

		retainTexture(texture);
	}

	public override destroy(options?: DestroyOptions): void {
		if (this.texture) {
			releaseTexture(this.texture);
		}

		super.destroy(options);
	}
}

export class DefaultAnimatedSprite extends AnimatedSprite {
	/** All currently-playing sprites, advanced once per frame from the rendering loop instead of Ticker.shared. */
	private static readonly list = new Set<DefaultAnimatedSprite>();
	/** Reused ticker-like object so updateAll() allocates nothing per frame. */
	private static readonly tickerArg = { deltaTime: 1 };

	public constructor(options?: Partial<AnimatedSpriteOptions>) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined; // Disable labels in production
		}

		super({
			textures: [Texture.EMPTY], // Fallback textures
			anchor: 0.5, // Center anchor by default
			eventMode: import.meta.env.DEV ? "auto" : "none", // Disable events in production by default
			autoUpdate: false, // Don't attach to Ticker.shared (we drive frames from the main loop — see updateAll)
			...options,
		});
	}

	public static updateAll(deltaMs: number): void {
		if (DefaultAnimatedSprite.list.size === 0) {
			return;
		}

		// Pixi's Ticker measures deltaTime in 60fps frame units (1.0 ≈ 16.667ms); convert from the loop's ms delta.
		DefaultAnimatedSprite.tickerArg.deltaTime = deltaMs / (1000 / 60);

		for (const sprite of DefaultAnimatedSprite.list) {
			sprite.update(DefaultAnimatedSprite.tickerArg as unknown as Ticker);
		}
	}

	public override play(): void {
		super.play();

		DefaultAnimatedSprite.list.add(this);

		this.textures;
	}

	public override stop(): void {
		super.stop();

		DefaultAnimatedSprite.list.delete(this);
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);

		DefaultAnimatedSprite.list.delete(this);
	}
}

export class DefaultGraphics extends Graphics {
	public constructor(options?: SpriteOptions) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined; // Disable labels in production
		}

		super({
			eventMode: import.meta.env.DEV ? "auto" : "none", // Disable events in production by default
			...options,
		});
	}
}

export class DefaultBitmapText extends BitmapText {
	public constructor(options?: TextOptions) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined; // Disable labels in production
		}

		super({
			anchor: 0.5,
			eventMode: import.meta.env.DEV ? "auto" : "none", // Disable events in production by default
			...options,
		});
	}

	public crop(width: number = 75, height: number = 15): void {
		this.height = Math.min(height, this.height);

		while (this.width > width) {
			this.text = this.text.slice(0, -1); // Remove last character
		}
	}
}
