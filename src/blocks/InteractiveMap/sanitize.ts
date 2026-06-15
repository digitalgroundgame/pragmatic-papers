import sanitizeHtml from "sanitize-html"

const ALLOWED_SVG_TAGS = ["svg", "g", "path", "title", "desc"]

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
