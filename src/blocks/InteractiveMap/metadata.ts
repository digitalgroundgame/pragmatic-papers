import { Parser } from "htmlparser2"

/**
 * Pulls the text content of the first `<metadata>` element out of a sanitized SVG.
 *
 * `sanitizeMapSvg` runs `sanitize-html`, an HTML sanitizer, so the JSON a drilldown asset
 * carries in `<metadata>` comes back entity-escaped (`"` → `&quot;`, `&` → `&amp;`, …).
 * htmlparser2 decodes entities in text nodes by default, so reading the text through it
 * — rather than slicing the string between two tags — restores the original payload.
 *
 * Returns `null` when the SVG carries no `<metadata>` element or it is empty.
 */
export function extractSvgMetadata(sanitizedSvg: string): string | null {
  let depth = 0
  let found = false
  const chunks: string[] = []

  const parser = new Parser(
    {
      onopentag(name) {
        if (name.toLowerCase() === "metadata") {
          if (!found) depth += 1
        }
      },
      ontext(text) {
        if (depth > 0 && !found) chunks.push(text)
      },
      onclosetag(name) {
        if (name.toLowerCase() === "metadata" && depth > 0) {
          depth -= 1
          if (depth === 0) found = true
        }
      },
    },
    { xmlMode: false, lowerCaseTags: true, lowerCaseAttributeNames: false, decodeEntities: true },
  )
  parser.write(sanitizedSvg)
  parser.end()

  const text = chunks.join("").trim()
  return text.length > 0 ? text : null
}

/**
 * Decodes and parses the JSON payload a drilldown asset carries in `<metadata>`.
 *
 * Returns `null` when there is no payload or it is not valid JSON — a malformed payload
 * must degrade to "no records", never throw during a server render.
 */
export function parseSvgMetadataJson(sanitizedSvg: string): unknown {
  const text = extractSvgMetadata(sanitizedSvg)
  if (text === null) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}
