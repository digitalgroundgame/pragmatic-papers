import sanitizeHtml from "sanitize-html"

// This allowlist is a security boundary: uploaded SVG is rendered inline on the page.
// Widen it deliberately. <script>, <style>, <foreignObject> and every on* handler stay out —
// the sanitizer tests assert this after each change.
const ALLOWED_SVG_TAGS = ["svg", "g", "path", "title", "desc"]

// Discarding a tag keeps its text by default, which would leave an exporter's <metadata>
// document dumped into the markup as a bare text node. These carry no drawable content, so
// drop the text with the tag.
const NON_TEXT_TAGS = ["script", "style", "textarea", "option", "metadata"]

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
    nonTextTags: NON_TEXT_TAGS,
    disallowedTagsMode: "discard",
  })
}
