import { describe, expect, it } from "vitest"

import { sanitizeMapSvg } from "@/blocks/InteractiveMap/sanitize"

describe("sanitizeMapSvg", () => {
  it("strips <script> tags", () => {
    const input = `<svg viewBox="0 0 10 10"><script>alert('xss')</script><path d="M0 0H10"/></svg>`
    const out = sanitizeMapSvg(input)
    expect(out).not.toContain("<script")
    expect(out).not.toContain("alert")
    expect(out).toContain('viewBox="0 0 10 10"')
    expect(out).toContain('<path d="M0 0H10"')
  })

  it("preserves viewBox case (the htmlparser2 lowercase trap)", () => {
    const input = `<svg viewBox="0 0 100 100"><path d="M0 0"/></svg>`
    expect(sanitizeMapSvg(input)).toContain('viewBox="0 0 100 100"')
  })

  it("preserves data-* attributes on paths", () => {
    const input = `<svg viewBox="0 0 1 1"><path d="M0 0" data-region="MO-01" data-extra="x"/></svg>`
    const out = sanitizeMapSvg(input)
    expect(out).toContain('data-region="MO-01"')
    expect(out).toContain('data-extra="x"')
  })

  it("strips inline event handlers", () => {
    const input = `<svg viewBox="0 0 1 1"><path d="M0 0" onclick="alert(1)"/></svg>`
    expect(sanitizeMapSvg(input)).not.toContain("onclick")
  })

  it("strips disallowed tags like <iframe>", () => {
    const input = `<svg viewBox="0 0 1 1"><iframe src="http://evil"></iframe><path d="M0 0"/></svg>`
    const out = sanitizeMapSvg(input)
    expect(out).not.toContain("iframe")
    expect(out).not.toContain("evil")
  })
})
