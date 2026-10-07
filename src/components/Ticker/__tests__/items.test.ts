import { describe, expect, it } from "vitest"

import { excerpt, mergePosts, tickerDuration, type TickerPost } from "../items"

const post = (id: string, createdAt: string, text = id): TickerPost => ({
  id,
  source: id.startsWith("x") ? "x" : "bluesky",
  text,
  url: `https://example.com/${id}`,
  createdAt,
})

describe("mergePosts", () => {
  it("interleaves every source's posts, newest first, up to the limit", () => {
    const bluesky = [post("b1", "2026-10-07T10:00:00Z"), post("b2", "2026-10-05T10:00:00Z")]
    const x = [post("x1", "2026-10-06T10:00:00Z"), post("x2", "2026-10-04T10:00:00Z")]
    expect(mergePosts([bluesky, x], 3).map((p) => p.id)).toEqual(["b1", "x1", "b2"])
  })

  it("shows a cross-post once, ignoring links, case and spacing", () => {
    const bluesky = [
      post("b1", "2026-10-07T10:00:00Z", "New article:  The Filibuster https://bsky.app/x"),
    ]
    const x = [post("x1", "2026-10-07T10:01:00Z", "New article: the filibuster https://t.co/abc")]
    expect(mergePosts([bluesky, x]).map((p) => p.id)).toEqual(["x1"])
  })
})

describe("excerpt", () => {
  it("puts a post on one line", () => {
    expect(excerpt("Line one\n\nline   two")).toBe("Line one line two")
  })

  it("cuts a long post at a word, without trailing punctuation", () => {
    const text = "The quick brown fox, jumps over the lazy dog again and again"
    expect(excerpt(text, 24)).toBe("The quick brown fox…")
  })

  it("cuts mid-word when there's no space near the end", () => {
    expect(excerpt("a".repeat(50), 10)).toBe(`${"a".repeat(10)}…`)
  })
})

describe("tickerDuration", () => {
  it("never scrolls faster than one pass every 30 seconds", () => {
    expect(tickerDuration([post("b1", "2026-10-07T10:00:00Z", "short")])).toBe(30)
  })

  it("gives longer content proportionally longer", () => {
    const long = Array.from({ length: 8 }, (_, i) =>
      post(`b${i}`, "2026-10-07T10:00:00Z", "x".repeat(140)),
    )
    expect(tickerDuration(long)).toBe(Math.round((8 * 140) / 6))
  })
})
