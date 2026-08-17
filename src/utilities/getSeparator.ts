/**
 * How a byline joins its authors.
 *
 * - `list` — prose list: `Ada & Grace`, `Ada, Grace, & Radia`.
 * - `bullet` — every author separated by a bullet: `Ada • Grace • Radia`.
 */
export type SeparatorVariant = "list" | "bullet"

/** The word or symbol joining the last two names in a `list`. */
export type SeparatorConjunction = "&" | "and"

export interface SeparatorOptions {
  variant?: SeparatorVariant
  /** Ignored by the `bullet` variant, which has no final conjunction. */
  conjunction?: SeparatorConjunction
  /**
   * Whether three or more names take a comma before the conjunction —
   * `Ada, Grace, & Radia` vs `Ada, Grace & Radia`. Two names never do.
   * Ignored by the `bullet` variant.
   */
  oxfordComma?: boolean
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
  { variant = "list", conjunction = "&", oxfordComma = true }: SeparatorOptions = {},
): string | undefined {
  if (index === 0) return undefined
  if (variant === "bullet") return " • "
  if (index === length - 1) {
    // A pair reads "Ada & Grace" — the comma only ever separates three or more.
    return length === 2 || !oxfordComma ? ` ${conjunction} ` : `, ${conjunction} `
  }
  return ", "
}
