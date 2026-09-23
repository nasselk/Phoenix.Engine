declare module "troika-three-text" {
	export const Text: unknown;

	export function preloadFont(options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number }, callback: () => void): void;

	export function configureTextBuilder(config: { defaultFontURL?: string; unicodeFontsURL?: string; sdfGlyphSize?: number; sdfExponent?: number; sdfMargin?: number; textureWidth?: number; useWorker?: boolean }): void;
}
