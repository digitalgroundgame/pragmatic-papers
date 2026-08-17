/**
 * How a byline joins its authors.
 *
 * - `oxford` — prose list: `Ada & Grace`, `Ada, Grace, & Radia`. Two names
 *   take a bare conjunction; the Oxford comma only disambiguates three or
 *   more.
 * - `bullet` — every author separated by a bullet: `Ada • Grace • Radia`.
 */
export type SeparatorVariant = "oxford" | "bullet"

/** The word or symbol joining the last two names in an `oxford` list. */
export type SeparatorConjunction = "&" | "and"

export interface SeparatorOptions {
  variant?: SeparatorVariant
  /** Ignored by the `bullet` variant, which has no final conjunction. */
  conjunction?: SeparatorConjunction
}

/**
 * The separator to render *before* the author at `index`.
 *
 * Every separator includes its own surrounding whitespace, because the byline
 * renders its authors in inline flow — there is no flex `gap` to space them
 * out, so a bare `"•"` would come out as `Ada•Grace`.
 */
export function getSeparator(
  index: number,
  length: number,
  { variant = "oxford", conjunction = "&" }: SeparatorOptions = {},
): string | undefined {
  if (index === 0) return undefined
  if (variant === "bullet") return " • "
  if (index === length - 1) return length === 2 ? ` ${conjunction} ` : `, ${conjunction} `
  return ", "
}
