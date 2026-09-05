import { describe, expect, it } from "vitest"

import { extractSvgMetadata, parseSvgMetadataJson } from "@/blocks/InteractiveMap/metadata"
import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"

/** XML-escape text the way a writer's export pipeline must before embedding it in an SVG. */
const xmlText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const wrap = (metadata: string) =>
  `<svg viewBox="0 0 10 10"><metadata>${metadata}</metadata><g><path id="a" d="M0 0L1 1"/></g></svg>`

describe("extractSvgMetadata", () => {
  it("returns the text inside <metadata>", () => {
    expect(extractSvgMetadata(`<svg><metadata>hello</metadata></svg>`)).toBe("hello")
  })

  it("returns null when there is no <metadata> or it is empty", () => {
    expect(extractSvgMetadata(`<svg><path d="M0 0"/></svg>`)).toBeNull()
    expect(extractSvgMetadata(`<svg><metadata>   </metadata></svg>`)).toBeNull()
  })

  it("reads only the first <metadata> element", () => {
    expect(extractSvgMetadata(`<svg><metadata>one</metadata><metadata>two</metadata></svg>`)).toBe(
      "one",
    )
  })
})

describe("parseSvgMetadataJson — entity-escaping round trip through the sanitizer", () => {
  const payload = {
    schema: "test@1",
    records: [
      { _region: "a", name: `O'Brien "Junior" <Jr> & Sons`, note: "tab\tnew\nline", n: 1.5 },
      { _region: "b", name: "Ünïcödé — ✓", url: "https://example.com/?a=1&b=2" },
    ],
    nested: { deep: [true, null, [1, 2]] },
  }

  it("recovers the exact object after sanitize-html has entity-escaped the text node", () => {
    const raw = wrap(xmlText(JSON.stringify(payload)))
    const sanitized = sanitizeMapSvg(raw)
    // Proof the round trip is doing real work: the sanitized text is no longer valid JSON
    // (sanitize-html re-escapes &, < and > in text nodes).
    expect(sanitized).toContain("&lt;Jr&gt;")
    expect(sanitized).toContain("&amp;")
    expect(parseSvgMetadataJson(sanitized)).toEqual(payload)
  })

  it("returns null for a payload that is not JSON instead of throwing", () => {
    expect(parseSvgMetadataJson(sanitizeMapSvg(wrap("not json")))).toBeNull()
  })

  it("returns null when the SVG has no <metadata>", () => {
    expect(parseSvgMetadataJson(sanitizeMapSvg(`<svg><path d="M0 0"/></svg>`))).toBeNull()
  })

  it("does not let a payload smuggle markup: tags inside the text stay text", () => {
    const evil = wrap(xmlText(JSON.stringify({ x: "<script>alert(1)</script>" })))
    const sanitized = sanitizeMapSvg(evil)
    expect(sanitized).not.toContain("<script")
    expect(parseSvgMetadataJson(sanitized)).toEqual({ x: "<script>alert(1)</script>" })
  })
})
