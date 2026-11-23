import { warn } from "../../../shared/utils/logger";
import type { JsonObject } from "../../../shared/utils/types";
import { deepMerge } from "../../../shared/utils/utils";

/** A language's text: any part of the base text, every piece optional. What it leaves out shows in the base language. */
export type Translation<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? Translation<T[K]> : T[K] };

/** A language a player can pick: its locale, and its name in itself. */
export type Language = { readonly value: string; readonly name: string };

function languageOf(locale: string): string {
	return locale.split("-")[0]!;
}

/**
 * A game's text in several languages: `base` built in, the others loaded only when a player picks one, each
 * filled in from `base` wherever it leaves something out.
 */
export class Languages<T extends object> {
	/** Every language a player can pick, the base first, each named in itself. */
	public readonly locales: readonly Language[];
	private readonly loaded = new Map<string, T>();

	/**
	 * @param base The text built into the game, which every other language falls back to.
	 * @param others Each other language by its locale (`fr-FR`), loaded on demand: what `import.meta.glob` gives, keyed by locale.
	 * @param baseLocale The locale `base` is written in.
	 */
	public constructor(
		public readonly base: T,
		private readonly others: Readonly<Record<string, () => Promise<Translation<T>>>>,
		public readonly baseLocale: string = "en-US",
	) {
		const all = [baseLocale, ...Object.keys(others)];

		this.locales = all.map((locale) => ({ value: locale, name: this.nameOf(locale, all) }));
	}

	/** A locale's name in its own language: the language alone, or with its country when two locales share the language. */
	private nameOf(locale: string, all: readonly string[]): string {
		const shared = all.filter((other) => languageOf(other) === languageOf(locale)).length > 1;
		const name = new Intl.DisplayNames([locale], { type: "language" }).of(shared ? locale : languageOf(locale)) ?? locale;

		return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
	}

	/**
	 * The text for a locale: its own language, else another of the same language (`fr-CA` → `fr-FR`), else `base`,
	 * filled in from `base`. Each language is loaded once; `base` itself when it cannot be.
	 */
	public async load(locale: string): Promise<T> {
		const match = locale in this.others ? locale : Object.keys(this.others).find((other) => languageOf(other) === languageOf(locale));

		if (match === undefined) {
			return this.base;
		}

		const cached = this.loaded.get(match);

		if (cached !== undefined) {
			return cached;
		}

		try {
			const text = deepMerge(structuredClone(this.base) as JsonObject, (await this.others[match]!()) as JsonObject) as T;

			this.loaded.set(match, text);

			return text;
		} catch (err) {
			warn("Languages", `Showing ${this.baseLocale}: could not load ${match}`, err);

			return this.base;
		}
	}
}
