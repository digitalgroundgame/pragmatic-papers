/**
 * Skips the named axe rules on one story; every other rule still runs. Cite the
 * issue tracking the fix next to each use.
 */
export function skipA11yRules(...ids: string[]): {
  a11y: { config: { rules: { id: string; enabled: boolean }[] } }
} {
  return { a11y: { config: { rules: ids.map((id) => ({ id, enabled: false })) } } }
}

/**
 * White text on the brand fill (`Button`/`LinkButton` `branded`, `Badge` `brand`) is
 * 3.49:1, short of AA — #998. Delete this once #998 lands; the type errors point at
 * each story to re-enable.
 */
export const brandFillContrastIssue = skipA11yRules("color-contrast")
