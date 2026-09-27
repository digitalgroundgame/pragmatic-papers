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
 * Brand and destructive colors fall short of AA — #998. Delete this once #998
 * lands; the type errors point at each story to re-enable.
 */
export const knownContrastIssue = skipA11yRules("color-contrast", "link-in-text-block")
