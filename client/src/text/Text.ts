import { type BufferGeometry, type Camera, type ColorRepresentation, type Group, type Material, Mesh, Quaternion, type Scene, type WebGLRenderer } from "three";
import { configureTextBuilder, preloadFont as preloadTroikaFont, Text as TroikaText } from "troika-three-text";
import type { AssetLoader } from "../assets/AssetManager";

type Length = number | `${number}%`;

/**
 * Everything troika lays text out and draws it with. Declared here rather than taken from troika,
 * which ships no types — and these are accessors on troika's prototype, so they are typed through
 * this interface and never redeclared as fields, which would shadow the setters that trigger a sync.
 */
export interface TextProperties {
	text: string;
	/** A .ttf, .otf or .woff URL. Left null, glyphs come from the unicode font fallback, which covers every script. */
	font: string | null;
	fontSize: number;
	fontWeight: number | "normal" | "bold";
	fontStyle: "normal" | "italic";
	lang: string | null;
	letterSpacing: number;
	lineHeight: number | "normal";
	maxWidth: number;
	overflowWrap: "normal" | "break-word";
	textAlign: "left" | "right" | "center" | "justify";
	textIndent: number;
	whiteSpace: "normal" | "nowrap";
	direction: "auto" | "ltr" | "rtl";
	anchorX: Length | "left" | "center" | "right";
	anchorY: Length | "top" | "top-baseline" | "top-cap" | "top-ex" | "middle" | "bottom-baseline" | "bottom";
	curveRadius: number;
	unicodeFontsURL: string | null;
	color: ColorRepresentation | null;
	colorRanges: Record<number, ColorRepresentation> | null;
	fillOpacity: number;
	outlineWidth: Length;
	outlineColor: ColorRepresentation;
	outlineOpacity: number;
	outlineBlur: Length;
	outlineOffsetX: Length;
	outlineOffsetY: Length;
	strokeWidth: Length;
	strokeColor: ColorRepresentation;
	strokeOpacity: number;
	depthOffset: number;
	clipRect: [minX: number, minY: number, maxX: number, maxY: number] | null;
	orientation: string;
	glyphGeometryDetail: number;
	sdfGlyphSize: number | null;
	gpuAccelerateSDF: boolean;
	debugSDF: boolean;
}

interface TroikaTextInstance extends Mesh, TextProperties {
	/** Lays the text out again if anything changed. Rendering does this on its own; call it to have the result sooner. */
	sync(callback?: () => void): void;
	dispose(): void;
	hasOutline(): boolean;
}

export type TextOptions = Partial<TextProperties> & {
	/** Always face the camera drawing it, like a sprite. */
	readonly billboard?: boolean;
};

export type TextConfig = {
	readonly defaultFontURL?: string;
	/** Where the unicode fallback fonts are fetched from instead of the public CDN, to self-host them. */
	readonly unicodeFontsURL?: string;
	readonly sdfGlyphSize?: number;
	readonly useWorker?: boolean;
};

const DEFAULTS: Partial<TextProperties> = {
	anchorX: "center",
	anchorY: "middle",
	color: 0xffffff,
	outlineWidth: "6%",
	outlineColor: 0x000000,
};

const parentRotation = new Quaternion();

/**
 * Crisp text in the scene at any distance or zoom: glyphs are signed distance fields laid out in a
 * worker, drawn by troika-three-text. It is a mesh like any other, so it is added to a group, moves
 * with it and hides behind whatever is in front of it.
 */
export class Text extends (TroikaText as new () => TroikaTextInstance) {
	public billboard: boolean;

	public constructor(text: string = "", { billboard = false, ...options }: TextOptions = {}) {
		super();

		Object.assign(this, DEFAULTS, options);

		this.text = text;
		this.billboard = billboard;
	}

	public override onBeforeRender(renderer: WebGLRenderer, scene: Scene, camera: Camera, geometry: BufferGeometry, material: Material, group: Group): void {
		if (this.billboard) {
			camera.getWorldQuaternion(this.quaternion);

			if (this.parent !== null) {
				this.quaternion.premultiply(this.parent.getWorldQuaternion(parentRotation).invert());
			}

			this.updateMatrixWorld();
		}

		super.onBeforeRender(renderer, scene, camera, geometry, material, group);
	}

	/** Take it out of the scene and free its geometry. */
	public destroy(): void {
		this.removeFromParent();
		this.dispose();
	}
}

/** Fetch a font and build the glyphs for these characters ahead of time, so the first text using them is not a frame late. */
export function preloadFont(font?: string, characters: string | readonly string[] = ""): Promise<void> {
	return new Promise((resolve) => {
		preloadTroikaFont({ font, characters: typeof characters === "string" ? characters : [...characters] }, resolve);
	});
}

declare module "../assets/AssetCache" {
	interface AssetKinds {
		/** A font's URL, once it is fetched and these characters are laid out, to hand to `Text` as `font`. */
		font: string;
	}
}

const LATIN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?'\"-_()[]";

/**
 * Loads fonts through the asset manager, so they count toward its progress:
 *
 *   engine.assets.register("font", fontLoader());
 *   await engine.assets.load("font", "ui", "/fonts/Inter.woff");
 *   new Text("Hello", { font: engine.assets.get("font", "ui") });
 */
export function fontLoader(characters: string | readonly string[] = LATIN): AssetLoader<string> {
	return {
		load: async (url) => {
			await preloadFont(url, characters);

			return url;
		},
	};
}

/** Settings every text shares. Only takes effect before the first text is laid out. */
export function configureText(config: TextConfig): void {
	configureTextBuilder(config);
}
