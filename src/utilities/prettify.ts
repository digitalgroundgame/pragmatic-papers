/**
 * The Prettify<T> type reconstructs an equivalent type to T, but "flattens"
 * intersections, mapped types, and inferred types. This is useful primarily for
 * displaying easier-to-read types in IDEs and editor tooltips, as TypeScript
 * tends to display complex or intersected types in a less readable manner.
 *
 * Example:
 * ```typescript
 *   type Foo = { a: number } & { b: string };
 *   type PrettyFoo = Prettify<Foo>;
 *   // PrettyFoo is now shown as { a: number; b: string }
 * ```
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}
