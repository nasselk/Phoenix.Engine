import { AnimatedSprite, BitmapText, Container, Graphics, Sprite, Texture } from "pixi.js";
export class DefaultContainer extends Container {
    constructor(options) {
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
    constructor(options) {
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
export class DefaultAnimatedSprite extends AnimatedSprite {
    constructor(options) {
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
    static updateAll(deltaMs) {
        if (DefaultAnimatedSprite.list.size === 0) {
            return;
        }
        DefaultAnimatedSprite.tickerArg.deltaTime = deltaMs / (1000 / 60);
        for (const sprite of DefaultAnimatedSprite.list) {
            sprite.update(DefaultAnimatedSprite.tickerArg);
        }
    }
    play() {
        super.play();
        DefaultAnimatedSprite.list.add(this);
    }
    stop() {
        super.stop();
        DefaultAnimatedSprite.list.delete(this);
    }
    destroy(options) {
        super.destroy(options);
        DefaultAnimatedSprite.list.delete(this);
    }
}
DefaultAnimatedSprite.list = new Set();
DefaultAnimatedSprite.tickerArg = { deltaTime: 1 };
export class DefaultGraphics extends Graphics {
    constructor(options) {
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
    constructor(options) {
        if (import.meta.env.PROD && options?.label) {
            options.label = undefined;
        }
        super({
            anchor: 0.5,
            eventMode: import.meta.env.DEV ? "auto" : "none",
            ...options,
        });
    }
    crop(width = 75, height = 15) {
        this.height = Math.min(height, this.height);
        while (this.width > width) {
            this.text = this.text.slice(0, -1);
        }
    }
}
