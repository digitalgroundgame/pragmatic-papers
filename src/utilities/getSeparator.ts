/**
 * How a byline joins its authors.
 *
 * - `oxford` — prose list: `Ada`, `Ada & Grace`, `Ada, Grace, & Radia`. Two
 *   names take a bare ampersand; the Oxford comma only disambiguates three or
 *   more.
 * - `bullet` — every author separated by a bullet: `Ada • Grace • Radia`.
 */
export type SeparatorVariant = "oxford" | "bullet"

/**
 * The separator to render *before* the author at `index`.
 *
 * Both variants include their own surrounding whitespace, because the byline
 * renders its authors in inline flow — there is no flex `gap` to space them
 * out, so a bare `"•"` would come out as `Ada•Grace`.
 */
export function getSeparator(
  index: number,
  length: number,
  variant: SeparatorVariant = "oxford",
): string | undefined {
  if (index === 0) return undefined
  if (variant === "bullet") return " • "
  if (index === length - 1) return length === 2 ? " & " : ", & "
  return ", "
}
