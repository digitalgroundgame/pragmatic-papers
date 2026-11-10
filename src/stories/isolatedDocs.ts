/**
 * Docs-page parameters for a story file whose stories stub `window.fetch`.
 *
 * The docs page renders every story inline in one window, and each story's
 * `beforeEach` stubs that window's `fetch` in turn, so the last stub answers
 * them all (a list that should load shows an error, or nothing). Rendering each
 * story in its own iframe gives each its own window, and its own stub.
 */
export function isolatedDocs(height: string): {
  docs: { story: { inline: false; height: string } }
} {
  return { docs: { story: { inline: false, height } } }
}
