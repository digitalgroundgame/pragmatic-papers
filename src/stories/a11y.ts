/**
 * Skips the named axe rules on one story; every other rule still runs. Cite the
 * issue tracking the fix next to each use.
 */
export function skipA11yRules(...ids: string[]): {
  a11y: { config: { rules: { id: string; enabled: boolean }[] } }
} {
  return { a11y: { config: { rules: ids.map((id) => ({ id, enabled: false })) } } }
}
