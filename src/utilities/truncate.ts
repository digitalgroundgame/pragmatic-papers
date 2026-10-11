/**
 * Cut `text` to `limit` characters and mark the cut with "…" (which isn't counted). With
 * `atWord`, the cut backs up to the last space and drops the punctuation it leaves dangling,
 * so a word is never split. Text within the limit comes back as is.
 */
export function truncate(text: string, limit: number, { atWord = false } = {}): string {
  if (text.length <= limit) return text
  let cut = text.slice(0, limit)
  if (atWord) {
    const lastSpace = cut.lastIndexOf(" ")
    if (lastSpace > 0) cut = cut.slice(0, lastSpace)
    cut = cut.replace(/[\s.,;:]+$/, "")
  }
  return `${cut.trimEnd()}…`
}
