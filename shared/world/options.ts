/**
 * The options a kind is spawned with: the type of its constructor's parameter at `Index` — 2 on the
 * server `(world, context, options)`, 3 on the client `(world, context, group, options)`.
 *
 * Read from the constructor rather than declared beside it, so a kind's options can never drift from
 * what its constructor actually takes.
 */
export type OptionsOf<Kind, Index extends number> = Kind extends abstract new (...args: infer Args) => any ? NonNullable<Args[Index]> : never;

/**
 * `spawn`'s options argument: required when the kind has a field it cannot default, optional when
 * every field can be left out.
 */
export type SpawnArguments<Kind, Index extends number> = {} extends OptionsOf<Kind, Index> ? [options?: OptionsOf<Kind, Index>] : [options: OptionsOf<Kind, Index>];
