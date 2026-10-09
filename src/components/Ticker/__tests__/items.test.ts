import { describe, expect, it } from "vitest"

import {
  excerpt,
  mergePosts,
  postKey,
  postLinks,
  postText,
  tickerDuration,
  withoutHidden,
  type TickerPost,
} from "../items"

const post = (
  id: string,
  createdAt: string,
  text = id,
  links: TickerPost["links"] = [],
): TickerPost => ({
  id,
  source: id.startsWith("x") ? "x" : "bluesky",
  text,
  links,
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

  it("matches a cross-post whose links each service shortened its own way", () => {
    const bluesky = [
      post("b1", "2026-10-07T10:00:00Z", "Out now pragmaticpapers.com/vol-12...", [
        { text: "pragmaticpapers.com/vol-12...", url: "https://pragmaticpapers.com/vol-12" },
      ]),
    ]
    const x = [
      post("x1", "2026-10-07T10:01:00Z", "Out now https://t.co/abc", [
        { text: "https://t.co/abc", url: "https://pragmaticpapers.com/vol-12" },
      ]),
    ]
    expect(mergePosts([bluesky, x]).map((p) => p.id)).toEqual(["x1"])
  })

  it("keeps posts that are only a link apart", () => {
    const a = post("b1", "2026-10-07T10:00:00Z", "https://a.example")
    const b = post("b2", "2026-10-07T10:01:00Z", "https://b.example")
    expect(mergePosts([[a, b]])).toHaveLength(2)
  })
})

describe("postText and postLinks", () => {
  const withLinks = post(
    "b1",
    "2026-10-07T10:00:00Z",
    "Read it pragmaticpapers.com/fili... and https://example.com/bare too",
    [{ text: "pragmaticpapers.com/fili...", url: "https://pragmaticpapers.com/filibuster" }],
  )

  it("leaves the links out of the words", () => {
    expect(postText(withLinks)).toBe("Read it and too")
  })

  it("lists the marked links, by where they lead, then bare URLs, each once", () => {
    expect(postLinks(withLinks)).toEqual([
      "https://pragmaticpapers.com/filibuster",
      "https://example.com/bare",
    ])
    expect(
      postLinks(
        post("b2", "2026-10-07T10:00:00Z", "a.example b.example", [
          { text: "a.example", url: "https://a.example" },
          { text: "b.example", url: "https://a.example" },
        ]),
      ),
    ).toEqual(["https://a.example"])
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
  it("never scrolls faster than one pass every 40 seconds", () => {
    expect(tickerDuration([post("b1", "2026-10-07T10:00:00Z", "short")])).toBe(40)
  })

  it("gives longer content proportionally longer", () => {
    const long = Array.from({ length: 8 }, (_, i) =>
      post(`b${i}`, "2026-10-07T10:00:00Z", "x".repeat(140)),
    )
    expect(tickerDuration(long)).toBe(Math.round((8 * 140) / 4.5))
  })

  it("counts each link's icon, not its URL", () => {
    const linked = (i: number) =>
      post(
        `b${i}`,
        "2026-10-07T10:00:00Z",
        `${"x".repeat(100)} https://example.com/${"y".repeat(80)}`,
      )
    const posts = Array.from({ length: 4 }, (_, i) => linked(i))
    expect(tickerDuration(posts)).toBe(Math.round((4 * (100 + 3)) / 4.5))
  })
})

describe("postKey", () => {
  it.each([
    ["https://bsky.app/profile/PP.bsky.social/post/3k1", "bluesky:pp.bsky.social/3k1"],
    [" https://bsky.app/profile/pp.bsky.social/post/3k1?ref=share ", "bluesky:pp.bsky.social/3k1"],
    ["https://x.com/PragPapers/status/42", "x:42"],
    ["https://twitter.com/PragPapers/status/42?s=20", "x:42"],
    ["https://mobile.x.com/i/status/42", "x:42"],
  ])("reads %s as one post however it's written", (link, key) => {
    expect(postKey(link)).toBe(key)
  })

  it.each([
    ["a profile", "https://bsky.app/profile/pp.bsky.social"],
    ["another site", "https://example.com/profile/pp/post/1"],
    ["not a link", "PragPapers 42"],
  ])("is null for %s", (_, link) => {
    expect(postKey(link)).toBeNull()
  })
})

describe("withoutHidden", () => {
  const bluesky = {
    ...post("b1", "2026-10-07T10:00:00Z"),
    url: "https://bsky.app/profile/pp.bsky.social/post/3k1",
  }
  const x = { ...post("x1", "2026-10-07T10:00:00Z"), url: "https://x.com/PragPapers/status/42" }

  it("leaves out the posts whose links an editor listed", () => {
    expect(withoutHidden([bluesky, x], ["https://twitter.com/PragPapers/status/42?s=20"])).toEqual([
      bluesky,
    ])
  })

  it("ignores entries that aren't links to posts", () => {
    expect(withoutHidden([bluesky, x], ["", "https://example.com"])).toEqual([bluesky, x])
  })
})
