import { describe, expect, test } from "bun:test";
import { Languages } from "../../client/src/utils/languages";

const english = { menu: { play: "Play", quit: "Quit" }, keys: ["W", "A"] };

function languages(others: Record<string, () => Promise<object>> = {}) {
	return new Languages(english, others);
}

describe("Languages", () => {
	test("lists the base locale first, each named in itself, with the country only where two share a language", () => {
		const locales = languages({ "fr-FR": async () => ({}), "pt-BR": async () => ({}), "pt-PT": async () => ({}) }).locales;

		expect(locales.map(({ value }) => value)).toEqual(["en-US", "fr-FR", "pt-BR", "pt-PT"]);
		expect(locales[0]!.name).toBe("English");
		expect(locales[1]!.name).toBe("Français");
		expect(locales[2]!.name).not.toBe(locales[3]!.name);
	});

	test("loads a locale, or another of its language, filled in from the base, and the base for any other", async () => {
		const french = { menu: { play: "Jouer" } };
		const text = languages({ "fr-FR": async () => french });

		expect(await text.load("fr-FR")).toEqual({ menu: { play: "Jouer", quit: "Quit" }, keys: ["W", "A"] });
		expect(await text.load("fr-CA")).toBe(await text.load("fr-FR"));
		expect(await text.load("de-DE")).toBe(english);
		expect(english.menu.play).toBe("Play");
	});

	test("loads each language once, and shows the base when one cannot load", async () => {
		let loads = 0;
		const text = languages({
			"es-ES": async () => {
				loads++;

				return { menu: { play: "Jugar" } };
			},
			"it-IT": () => Promise.reject(new Error("offline")),
		});

		await text.load("es-ES");
		await text.load("es-ES");

		expect(loads).toBe(1);
		expect(await text.load("it-IT")).toBe(english);
	});
});
