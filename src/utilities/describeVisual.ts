/**
 * Turn a bare noun phrase into a parenthetical narrator aside that reads
 * naturally in a text-to-speech engine like ElevenLabs, e.g.
 *   describeVisual('a timeline titled "Fall of Rome"')
 *     -> '(A timeline titled "Fall of Rome".)'
 *   describeVisual('an image', 'crowds gather outside the courthouse')
 *     -> '(An image: crowds gather outside the courthouse.)'
 *
 * The parentheses mark the line as the narrator stepping outside the article's
 * prose to describe something the listener can't see. `detail` (a caption, alt
 * description, or a block's own spoken rendering of its contents) follows the
 * colon so the listener hears what the visual contains.
 *
 * Shared with block-level narration helpers — a block that can render its own
 * contents aloud (see `blocks/Timeline/narration.ts`) builds the detail itself
 * and hands it back through here so every aside sounds the same.
 */
export function describeVisual(nounPhrase: string, detail?: string): string {
  const trimmedDetail = detail?.trim()
  let sentence = (trimmedDetail ? `${nounPhrase}: ${trimmedDetail}` : nounPhrase).trim()
  if (!/[.!?]$/.test(sentence)) sentence += "."
  return `(${sentence.charAt(0).toUpperCase()}${sentence.slice(1)})`
}
