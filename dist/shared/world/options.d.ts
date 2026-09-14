export type OptionsOf<Kind, Index extends number> = Kind extends abstract new (...args: infer Args) => any ? NonNullable<Args[Index]> : never;
export type SpawnArguments<Kind, Index extends number> = {} extends OptionsOf<Kind, Index> ? [options?: OptionsOf<Kind, Index>] : [options: OptionsOf<Kind, Index>];
