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

describe("sanitizeMapSvg — allow-list boundary", () => {
  it("strips <metadata>: nothing rendered inline reads a payload out of a file", () => {
    const input = `<svg viewBox="0 0 1 1"><metadata>{"a":1}</metadata><path d="M0 0"/></svg>`
    const out = sanitizeMapSvg(input)
    expect(out).not.toContain("<metadata")
    expect(out).not.toContain(`{"a":1}`)
    expect(out).toContain("<path")
  })

  it("still strips <script> even when nested inside a stripped element", () => {
    const input = `<svg viewBox="0 0 1 1"><metadata><script>alert(1)</script>{"a":1}</metadata></svg>`
    const out = sanitizeMapSvg(input)
    expect(out).not.toContain("<script")
    expect(out).not.toContain("alert")
  })

  it("still strips <style>, <foreignObject>, <image> and <use>", () => {
    const input = `<svg viewBox="0 0 1 1"><style>path{fill:red}</style><foreignObject><div>x</div></foreignObject><image href="http://evil/x.png"/><use href="#a"/><path d="M0 0"/></svg>`
    const out = sanitizeMapSvg(input)
    for (const tag of ["<style", "<foreignObject", "<image", "<use", "<div"]) {
      expect(out).not.toContain(tag)
    }
    expect(out).not.toContain("evil")
  })

  it("still strips every on* event handler attribute", () => {
    const input = `<svg viewBox="0 0 1 1" onload="a()"><g onmouseover="c()"><path d="M0 0" onfocus="d()"/></g></svg>`
    const out = sanitizeMapSvg(input)
    expect(out).not.toMatch(/\son[a-z]+=/i)
  })

  it("strips href/xlink:href so no path can become a link or load a resource", () => {
    const input = `<svg viewBox="0 0 1 1"><path d="M0 0" href="javascript:alert(1)" xlink:href="javascript:alert(1)"/></svg>`
    const out = sanitizeMapSvg(input)
    expect(out).not.toContain("href")
    expect(out).not.toContain("javascript")
  })
})
