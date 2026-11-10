/**
 * Docs-page parameters that render a story in an iframe of its own, for a story
 * that changes something the whole document shares.
 *
 * The docs page renders every story of a file inline in one document. So when
 * each story's `beforeEach` stubs `window.fetch`, the last stub answers them
 * all (a list that should load shows an error, or nothing), and one story's
 * `globals: { theme: "dark" }` puts `dark` on <html> and turns the light
 * stories beside it dark. In its own iframe a story has its own window and its
 * own <html>.
 *
 * Put it on the meta when every story stubs `fetch`, or on the one story that
 * sets its own theme. A file whose meta sets the theme needs nothing: all its
 * stories agree.
 */
export function isolatedDocs(height: string): {
  docs: { story: { inline: false; height: string } }
} {
  return { docs: { story: { inline: false, height } } }
}
