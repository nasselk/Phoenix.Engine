import { AnimatedSprite, BitmapText, Container, Graphics, Sprite, Texture, type Ticker, type AnimatedSpriteOptions, type ContainerOptions, type DestroyOptions, type SpriteOptions, type TextOptions } from "pixi.js";

/**
 * Pixi display objects with this engine's defaults already applied, so a game
 * never repeats them: centred anchors, hit-testing off in production, and
 * debug labels stripped from production builds.
 *
 * Use these instead of pixi's own classes; they are the same objects with the
 * boilerplate pre-filled, and any option can still be overridden per instance.
 */
export class DefaultContainer extends Container {
	public constructor(options?: ContainerOptions) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined;
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
			options.label = undefined;
		}

		super({
			texture: Texture.EMPTY,
			anchor: 0.5,
			eventMode: import.meta.env.DEV ? "auto" : "none",
			...options,
		});
	}
}

/**
 * An AnimatedSprite driven by the engine's loop rather than pixi's shared
 * ticker: `autoUpdate` is off and `updateAll` advances every playing sprite
 * once per frame, so animation stops when the game does and one frame of the
 * game is one frame of the animation.
 */
export class DefaultAnimatedSprite extends AnimatedSprite {
	/** Currently playing sprites. Only these cost anything per frame. */
	private static readonly list = new Set<DefaultAnimatedSprite>();
	/**
	 * Reused so updateAll allocates nothing. AnimatedSprite.update asks for a
	 * Ticker but only reads `deltaTime` off it, so this stands in for one.
	 */
	private static readonly tickerArg = { deltaTime: 1 } as Ticker;

	public constructor(options?: Partial<AnimatedSpriteOptions>) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined;
		}

		super({
			textures: [Texture.EMPTY],
			anchor: 0.5,
			eventMode: import.meta.env.DEV ? "auto" : "none",
			autoUpdate: false,
			...options,
		});
	}

	/** Advance every playing sprite. `deltaMs` is milliseconds since the last frame. */
	public static updateAll(deltaMs: number): void {
		if (DefaultAnimatedSprite.list.size === 0) {
			return;
		}

		// Pixi counts in 60fps frames, not milliseconds.
		DefaultAnimatedSprite.tickerArg.deltaTime = deltaMs / (1000 / 60);

		for (const sprite of DefaultAnimatedSprite.list) {
			sprite.update(DefaultAnimatedSprite.tickerArg);
		}
	}

	public override play(): void {
		super.play();

		DefaultAnimatedSprite.list.add(this);
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
			options.label = undefined;
		}

		super({
			eventMode: import.meta.env.DEV ? "auto" : "none",
			...options,
		});
	}
}

export class DefaultBitmapText extends BitmapText {
	public constructor(options?: TextOptions) {
		if (import.meta.env.PROD && options?.label) {
			options.label = undefined;
		}

		super({
			anchor: 0.5,
			eventMode: import.meta.env.DEV ? "auto" : "none",
			...options,
		});
	}

	/** Truncate the text until it fits within `width`, and cap its height. */
	public crop(width: number = 75, height: number = 15): void {
		this.height = Math.min(height, this.height);

		while (this.width > width) {
			this.text = this.text.slice(0, -1);
		}
	}
}
