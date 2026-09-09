import { AnimatedSprite, BitmapText, Container, Graphics, Sprite, type AnimatedSpriteOptions, type ContainerOptions, type DestroyOptions, type SpriteOptions, type TextOptions } from "pixi.js";
export declare class DefaultContainer extends Container {
    constructor(options?: ContainerOptions);
}
export declare class DefaultSprite extends Sprite {
    constructor(options?: SpriteOptions);
}
export declare class DefaultAnimatedSprite extends AnimatedSprite {
    private static readonly list;
    private static readonly tickerArg;
    constructor(options?: Partial<AnimatedSpriteOptions>);
    static updateAll(deltaMs: number): void;
    play(): void;
    stop(): void;
    destroy(options?: DestroyOptions): void;
}
export declare class DefaultGraphics extends Graphics {
    constructor(options?: SpriteOptions);
}
export declare class DefaultBitmapText extends BitmapText {
    constructor(options?: TextOptions);
    crop(width?: number, height?: number): void;
}
