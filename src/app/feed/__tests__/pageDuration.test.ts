import { describe, expect, it } from "vitest"
import { getPageDurationMs } from "../pageDuration"
import { makeFeedArticle } from "./fixtures"

describe("getPageDurationMs", () => {
  it("gives the hero a fixed dwell", () => {
    expect(getPageDurationMs({ kind: "hero", article: makeFeedArticle() })).toBe(4500)
  })

  it("times prose at reading speed, with a floor", () => {
    expect(getPageDurationMs({ kind: "content", nodes: [], wordCount: 10 })).toBe(3500)
    expect(getPageDurationMs({ kind: "content", nodes: [], wordCount: 220 })).toBe(60_000)
  })

  it("uses the block's own dwell, or the default", () => {
    const node = { type: "block" }
    expect(getPageDurationMs({ kind: "block", node, blockType: "timeline" })).toBe(8000)
    expect(getPageDurationMs({ kind: "block", node, blockType: "unregistered" })).toBe(6000)
  })
})
