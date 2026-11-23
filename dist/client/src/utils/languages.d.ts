export type Translation<T> = {
    [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? Translation<T[K]> : T[K];
};
export type Language = {
    readonly value: string;
    readonly name: string;
};
export declare class Languages<T extends object> {
    readonly base: T;
    private readonly others;
    readonly baseLocale: string;
    readonly locales: readonly Language[];
    private readonly loaded;
    constructor(base: T, others: Readonly<Record<string, () => Promise<Translation<T>>>>, baseLocale?: string);
    private nameOf;
    load(locale: string): Promise<T>;
}
//# sourceMappingURL=languages.d.ts.map