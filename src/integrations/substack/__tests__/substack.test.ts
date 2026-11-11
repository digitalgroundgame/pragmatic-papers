import { afterEach, describe, expect, it, vi } from "vitest"

import { integrationStatus } from "../../types"
import { parseFeed, publicationHost, substackPublications } from "../index"

const publication = substackPublications({
  id: "substack-example",
  label: "Example publication",
  defaultPublications: ["example"],
  defaultTypes: ["podcast"],
  publicationsEnv: "EXAMPLE_SUBSTACK_PUBLICATIONS",
})

const item = (slug: string, title: string, pubDate: string, extra = ""): string => `
  <item>
    <title><![CDATA[${title}]]></title>
    <description><![CDATA[A subtitle for ${slug}]]></description>
    <link>https://example.substack.com/p/${slug}</link>
    <guid isPermaLink="false">https://example.substack.com/p/${slug}</guid>
    <dc:creator><![CDATA[The Pragmatic Papers]]></dc:creator>
    <pubDate>${pubDate}</pubDate>
    <content:encoded><![CDATA[<p>Body with <title>not this</title></p>]]></content:encoded>
    ${extra}
  </item>`

const feed = (...items: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title><![CDATA[Example]]></title><link>https://example.substack.com</link>${items.join("")}</channel></rss>`

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("publicationHost", () => {
  it.each([
    ["thepragmaticpapers", "thepragmaticpapers.substack.com"],
    ["@thepragmaticpapers", "thepragmaticpapers.substack.com"],
    ["https://substack.com/@thepragmaticpapers", "thepragmaticpapers.substack.com"],
    ["substack.com/@ThePragmaticPapers/posts", "thepragmaticpapers.substack.com"],
    ["ThePragmaticPapers.substack.com", "thepragmaticpapers.substack.com"],
    ["https://thepragmaticpapers.substack.com/feed", "thepragmaticpapers.substack.com"],
    ["https://www.example.com/", "example.com"],
  ])("reads %s as the feed's host", (written, host) => {
    expect(publicationHost(written)).toBe(host)
  })

  it.each([
    ["nothing", " "],
    ["Substack's home page", "https://substack.com/"],
    ["not an address", "two words"],
  ])("is empty for %s", (_, written) => {
    expect(publicationHost(written)).toBe("")
  })
})

describe("parseFeed", () => {
  it("reads each item's title, subtitle, link and date, ignoring the post's body", () => {
    expect(
      parseFeed(
        feed(item("first", "Rock &amp; roll &#8217;s&#x21;", "Tue, 07 Oct 2026 12:00:00 GMT")),
      ),
    ).toEqual([
      {
        id: "https://example.substack.com/p/first",
        title: "Rock & roll ’s!",
        subtitle: "A subtitle for first",
        url: "https://example.substack.com/p/first",
        createdAt: "2026-10-07T12:00:00.000Z",
        type: "post",
      },
    ])
  })

  it("skips items with no title, a link that isn't to the web, or no date", () => {
    const noLink = item("x", "No link", "Tue, 07 Oct 2026 12:00:00 GMT").replace(
      /<link>.*<\/link>/,
      "<link>javascript:alert(1)</link>",
    )
    expect(
      parseFeed(
        feed(
          item("a", "", "Tue, 07 Oct 2026 12:00:00 GMT"),
          noLink,
          item("b", "No date", "someday"),
          item("c", "Kept", "Tue, 07 Oct 2026 12:00:00 GMT"),
        ),
      ).map((post) => post.title),
    ).toEqual(["Kept"])
  })

  it("tells podcast episodes and videos from written posts by their enclosure", () => {
    expect(
      parseFeed(
        feed(
          item(
            "episode",
            "Episode",
            "Tue, 07 Oct 2026 12:00:00 GMT",
            '<enclosure url="https://example.com/a.mp3" length="1" type="audio/mpeg"/>',
          ),
          item(
            "video",
            "Video",
            "Tue, 07 Oct 2026 12:00:00 GMT",
            "<enclosure type='video/mp4' url='https://example.com/a.mp4'/>",
          ),
          item(
            "cover",
            "Cover",
            "Tue, 07 Oct 2026 12:00:00 GMT",
            '<enclosure url="https://example.com/a.jpg" type="image/jpeg"/>',
          ),
          item("plain", "Plain", "Tue, 07 Oct 2026 12:00:00 GMT"),
        ),
      ).map((post) => [post.title, post.type]),
    ).toEqual([
      ["Episode", "podcast"],
      ["Video", "video"],
      ["Cover", "post"],
      ["Plain", "post"],
    ])
  })

  it("is empty for something that isn't a feed", () => {
    expect(parseFeed("<html><body>Not found</body></html>")).toEqual([])
  })
})

describe("substackPublications", () => {
  it("is configured with no credentials, and can be pointed at other publications", () => {
    expect(integrationStatus(publication)).toMatchObject({
      service: "Substack",
      target: "substack:example.substack.com",
      configured: true,
      unset: ["EXAMPLE_SUBSTACK_PUBLICATIONS"],
    })
    vi.stubEnv("EXAMPLE_SUBSTACK_PUBLICATIONS", "one, news.example.org,,")
    expect(publication.describe()).toBe("substack:one.substack.com, substack:news.example.org")
  })

  it("reads the admin's publications over the variable's, each once", () => {
    vi.stubEnv("EXAMPLE_SUBSTACK_PUBLICATIONS", "env")
    expect(
      publication.publications(["admin", "https://admin.substack.com/", "substack.com/@other"]),
    ).toEqual(["admin.substack.com", "other.substack.com"])
    expect(publication.publications([])).toEqual(["env.substack.com"])
    vi.stubEnv("EXAMPLE_SUBSTACK_PUBLICATIONS", "")
    expect(publication.publications(null)).toEqual(["example.substack.com"])
  })

  it("reads the admin's post types, or the default when they pick none", () => {
    expect(publication.types(["post", "podcast", "nonsense", "post"])).toEqual(["podcast", "post"])
    expect(publication.types([])).toEqual(["podcast"])
    expect(publication.types(null)).toEqual(["podcast"])
  })

  it("keeps only the post types asked for, before counting to the limit", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          feed(
            item("article", "Syndicated article", "Wed, 08 Oct 2026 12:00:00 GMT"),
            item(
              "episode",
              "Episode",
              "Tue, 07 Oct 2026 12:00:00 GMT",
              '<enclosure url="https://example.com/a.mp3" type="audio/mpeg"/>',
            ),
          ),
        ),
    )
    const posts = await publication.recentPosts({
      publication: "example",
      types: ["podcast"],
      limit: 1,
      fetchImpl,
    })
    expect(posts.map((post) => post.title)).toEqual(["Episode"])
  })

  it("reads the publication's RSS feed, newest first, up to the limit", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(
          feed(
            item("older", "Older", "Mon, 06 Oct 2026 12:00:00 GMT"),
            item("newest", "Newest", "Wed, 08 Oct 2026 12:00:00 GMT"),
            item("middle", "Middle", "Tue, 07 Oct 2026 12:00:00 GMT"),
          ),
          { headers: { "Content-Type": "application/rss+xml" } },
        ),
    )
    const signal = new AbortController().signal
    const posts = await publication.recentPosts({
      publication: "substack.com/@example",
      limit: 2,
      fetchImpl,
      signal,
    })
    expect(posts.map((post) => post.title)).toEqual(["Newest", "Middle"])
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.substack.com/feed",
      expect.objectContaining({ signal }),
    )
  })

  it("throws when Substack refuses, or the publication can't be read as one", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("", { status: 404 }))
    await expect(publication.recentPosts({ publication: "gone", fetchImpl })).rejects.toThrow(
      "Substack feed for gone.substack.com failed (HTTP 404)",
    )
    await expect(publication.recentPosts({ publication: " ", fetchImpl })).rejects.toThrow(
      "isn't a Substack publication",
    )
  })
})
