import { warn } from "../../../shared/utils/logger";
import { deepMerge } from "../../../shared/utils/utils";
function languageOf(locale) {
    return locale.split("-")[0];
}
export class Languages {
    constructor(base, others, baseLocale = "en-US") {
        this.base = base;
        this.others = others;
        this.baseLocale = baseLocale;
        this.loaded = new Map();
        const all = [baseLocale, ...Object.keys(others)];
        this.locales = all.map((locale) => ({ value: locale, name: this.nameOf(locale, all) }));
    }
    nameOf(locale, all) {
        const shared = all.filter((other) => languageOf(other) === languageOf(locale)).length > 1;
        const name = new Intl.DisplayNames([locale], { type: "language" }).of(shared ? locale : languageOf(locale)) ?? locale;
        return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
    }
    async load(locale) {
        const match = locale in this.others ? locale : Object.keys(this.others).find((other) => languageOf(other) === languageOf(locale));
        if (match === undefined) {
            return this.base;
        }
        const cached = this.loaded.get(match);
        if (cached !== undefined) {
            return cached;
        }
        try {
            const text = deepMerge(structuredClone(this.base), (await this.others[match]()));
            this.loaded.set(match, text);
            return text;
        }
        catch (err) {
            warn("Languages", `Showing ${this.baseLocale}: could not load ${match}`, err);
            return this.base;
        }
    }
}
//# sourceMappingURL=languages.js.map