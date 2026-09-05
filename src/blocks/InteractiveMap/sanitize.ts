import sanitizeHtml from "sanitize-html"

// This allowlist is a security boundary: uploaded SVG is rendered inline on the page.
// Widen it deliberately. <metadata> carries the drilldown mode's JSON record payload as a
// text node; sanitize-html entity-escapes that text, so read it back through a decoding
// parser (see `extractSvgMetadata`) rather than a regex. <script>, <style>, <foreignObject>
// and every on* handler stay out — the sanitizer tests assert this after each widening.
const ALLOWED_SVG_TAGS = ["svg", "g", "path", "title", "desc", "metadata"]

const ALLOWED_SVG_ATTRS = [
  "class",
  "id",
  "transform",
  "d",
  "style",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "vector-effect",
  "xmlns",
  "viewBox",
  "preserveAspectRatio",
  "role",
  "tabindex",
  "data-*",
  "aria-*",
]

export function sanitizeMapSvg(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_SVG_TAGS,
    allowedAttributes: {
      "*": ALLOWED_SVG_ATTRS,
    },
    parser: {
      lowerCaseAttributeNames: false,
      lowerCaseTags: false,
    },
    disallowedTagsMode: "discard",
  })
}
