// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { getAdapter } from "../adapters"
import { blueskyAdapter, fetchBlueskyOEmbed } from "../adapters/bluesky.adapter"
import { fetchRedditOEmbed, redditAdapter } from "../adapters/reddit.adapter"
import {
  buildTikTokSrc,
  fetchTikTokOEmbed,
  parseTikTokPostId,
  tiktokAdapter,
} from "../adapters/tiktok.adapter"
import { fetchTwitterOEmbed, twitterAdapter } from "../adapters/twitter.adapter"
import {
  fetchYouTubeOEmbed,
  parseYouTubeVideoId,
  youtubeAdapter,
} from "../adapters/youtube.adapter"

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

afterEach(() => {
  fetchMock.mockReset()
})

const params = (url: URL) => Object.fromEntries(url.searchParams)

const rich = { type: "rich", version: "1.0", html: "<blockquote></blockquote>" }

describe("getAdapter", () => {
  it("returns the adapter registered for each platform", () => {
    expect(getAdapter("bluesky")).toBe(blueskyAdapter)
    expect(getAdapter("reddit")).toBe(redditAdapter)
    expect(getAdapter("tiktok")).toBe(tiktokAdapter)
    expect(getAdapter("twitter")).toBe(twitterAdapter)
    expect(getAdapter("youtube")).toBe(youtubeAdapter)
  })

  it("returns null for a platform without an adapter", () => {
    expect(getAdapter("mastodon" as never)).toBeNull()
  })
})

describe("twitterAdapter", () => {
  it.each([
    "https://twitter.com/jack/status/20",
    "https://x.com/NASA/status/1790000000000000000",
    "https://x.com/some_user/status/123?s=20&t=abc",
    "https://X.COM/user/status/1/photo/1",
  ])("accepts the post URL %s", (url) => {
    expect(twitterAdapter.isValidUrl(url)).toBe(true)
  })

  it.each([
    "https://x.com/NASA",
    "https://x.com/NASA/status/not-a-number",
    "https://www.twitter.com/jack/status/20",
    "https://mobile.twitter.com/jack/status/20",
    "https://example.com/jack/status/20",
    "not a url",
    "",
  ])("rejects %s", (url) => {
    expect(twitterAdapter.isValidUrl(url)).toBe(false)
  })

  it("builds the oEmbed URL with its defaults", () => {
    const url = twitterAdapter.buildUrl({ url: "https://x.com/a/status/1" })

    expect(url.origin + url.pathname).toBe("https://publish.twitter.com/oembed")
    expect(params(url)).toEqual({
      url: "https://x.com/a/status/1",
      maxwidth: "550",
      hide_media: "false",
      hide_thread: "true",
      omit_script: "true",
      align: "none",
      lang: "en",
      theme: "light",
      dnt: "true",
    })
  })

  it("passes options through to the oEmbed URL", () => {
    const url = twitterAdapter.buildUrl({
      url: "https://x.com/a/status/1",
      maxwidth: 300,
      hideMedia: true,
      hideThread: false,
      theme: "dark",
      lang: "fr",
      align: "center",
      dnt: false,
    })

    expect(params(url)).toMatchObject({
      maxwidth: "300",
      hide_media: "true",
      hide_thread: "false",
      theme: "dark",
      lang: "fr",
      align: "center",
      dnt: "false",
    })
  })

  it("strips scripts and unknown attributes but keeps the embed's markup", async () => {
    const html = await twitterAdapter.sanitize(
      '<blockquote class="twitter-tweet" data-theme="dark" onclick="x()"><p lang="en" dir="ltr">Hi <a href="https://t.co/1">link</a></p></blockquote><script src="https://platform.twitter.com/widgets.js"></script>',
    )

    expect(html).toBe(
      '<blockquote class="twitter-tweet" data-theme="dark"><p lang="en" dir="ltr">Hi <a href="https://t.co/1">link</a></p></blockquote>',
    )
  })

  it("drops javascript: links", async () => {
    expect(await twitterAdapter.sanitize('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>")
  })
})

describe("youtubeAdapter", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", null],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/v/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/channel/UC123", null],
    ["https://youtu.be/", null],
    ["https://vimeo.com/123", null],
    ["dQw4w9WgXcQ", null],
  ])("parses %s as %s", (url, id) => {
    expect(parseYouTubeVideoId(url)).toBe(id)
    expect(youtubeAdapter.isValidUrl(url)).toBe(id !== null)
  })

  it("builds the oEmbed URL, adding maxheight only when given", () => {
    const url = "https://youtu.be/abc"

    expect(params(youtubeAdapter.buildUrl({ url }))).toEqual({
      url,
      format: "json",
      maxwidth: "640",
    })
    expect(params(youtubeAdapter.buildUrl({ url, maxwidth: 320, maxheight: 180 }))).toEqual({
      url,
      format: "json",
      maxwidth: "320",
      maxheight: "180",
    })
  })

  it("keeps only the iframe and its embed attributes", async () => {
    const html = await youtubeAdapter.sanitize(
      '<div><iframe src="https://www.youtube.com/embed/abc" width="640" height="360" allowfullscreen onload="x()"></iframe></div>',
    )

    expect(html).toBe(
      '<iframe src="https://www.youtube.com/embed/abc" width="640" height="360" allowfullscreen></iframe>',
    )
  })
})

describe("redditAdapter", () => {
  it.each([
    "https://www.reddit.com/r/politics/comments/abc123/some_title/",
    "https://reddit.com/r/politics/comments/abc123",
    "https://old.reddit.com/r/AskHistorians/comments/xyz/title/comment_id/",
    "https://np.reddit.com/r/news/comments/1",
    "https://new.reddit.com/r/news/comments/1",
    "https://amp.reddit.com/r/news/comments/1",
    "https://www.reddit.com/r/politics",
    "https://www.reddit.com/r/politics/",
  ])("accepts %s", (url) => {
    expect(redditAdapter.isValidUrl(url)).toBe(true)
  })

  it.each([
    "https://www.reddit.com/user/spez",
    "https://www.reddit.com/r/politics/top",
    "https://redd.it/abc123",
    "https://evilreddit.com/r/politics",
    "not a url",
  ])("rejects %s", (url) => {
    expect(redditAdapter.isValidUrl(url)).toBe(false)
  })

  it("builds the oEmbed URL with its defaults and overrides", () => {
    const url = "https://www.reddit.com/r/a/comments/1"

    expect(params(redditAdapter.buildUrl({ url }))).toEqual({
      url,
      format: "json",
      maxwidth: "550",
      parent: "false",
      live: "false",
      omitscript: "true",
    })
    expect(
      params(redditAdapter.buildUrl({ url, parent: true, live: true, omitscript: false })),
    ).toMatchObject({ parent: "true", live: "true", omitscript: "false" })
  })

  it("strips scripts from the embed", async () => {
    const html = await redditAdapter.sanitize(
      '<blockquote class="reddit-embed-bq" style="height:500px"><a href="https://www.reddit.com/r/a">a</a><br></blockquote><script async src="https://embed.reddit.com/widgets.js"></script>',
    )

    expect(html).toBe(
      '<blockquote class="reddit-embed-bq" style="height:500px"><a href="https://www.reddit.com/r/a">a</a><br /></blockquote>',
    )
  })
})

describe("blueskyAdapter", () => {
  it.each([
    ["https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l", true],
    ["https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3l6oveex3ii2l", true],
    ["https://bsky.app/profile/bsky.app", false],
    ["https://staging.bsky.app/profile/a/post/1", false],
    ["https://example.com/profile/a/post/1", false],
    ["not a url", false],
  ])("isValidUrl(%s) is %s", (url, valid) => {
    expect(blueskyAdapter.isValidUrl(url)).toBe(valid)
  })

  it("builds the oEmbed URL", () => {
    const url = "https://bsky.app/profile/a/post/1"
    const endpoint = blueskyAdapter.buildUrl({ url })

    expect(endpoint.origin + endpoint.pathname).toBe("https://embed.bsky.app/oembed")
    expect(params(endpoint)).toEqual({ url, format: "json", maxwidth: "550" })
  })

  it("keeps the data attributes the embed script needs", async () => {
    const html = await blueskyAdapter.sanitize(
      '<blockquote class="bluesky-embed" data-bluesky-uri="at://x" data-bluesky-cid="c" data-other="y"><p lang="en">Hi</p></blockquote><script src="https://embed.bsky.app/static/embed.js"></script>',
    )

    expect(html).toBe(
      '<blockquote class="bluesky-embed" data-bluesky-uri="at://x" data-bluesky-cid="c"><p lang="en">Hi</p></blockquote>',
    )
  })
})

describe("tiktokAdapter", () => {
  it.each([
    ["https://www.tiktok.com/@scout2015/video/6718335390845095173", "6718335390845095173"],
    ["https://tiktok.com/@user/video/123?is_from_webapp=1", "123"],
    ["https://m.tiktok.com/v/123.html", null],
    ["https://m.tiktok.com/@user/video/123", "123"],
    ["https://www.tiktok.com/@user", null],
    ["https://vm.tiktok.com/ZMabc/", null],
    ["https://example.com/@user/video/123", null],
    ["not a url", null],
  ])("parses %s as %s", (url, id) => {
    expect(parseTikTokPostId(url)).toBe(id)
    expect(tiktokAdapter.isValidUrl(url)).toBe(id !== null)
  })

  it("points oEmbed at www.tiktok.com, which the endpoint requires", () => {
    expect(
      tiktokAdapter.buildUrl({ url: "https://tiktok.com/@u/video/1" }).searchParams.get("url"),
    ).toBe("https://www.tiktok.com/@u/video/1")
    expect(
      tiktokAdapter.buildUrl({ url: "https://m.tiktok.com/@u/video/1" }).searchParams.get("url"),
    ).toBe("https://m.tiktok.com/@u/video/1")
  })

  it("builds the player URL with default and overridden settings", () => {
    const src = new URL(buildTikTokSrc("123"))

    expect(src.origin + src.pathname).toBe("https://www.tiktok.com/player/v1/123")
    expect(params(src)).toMatchObject({ controls: "1", loop: "0", autoplay: "0", rel: "1" })
    expect(params(new URL(buildTikTokSrc("123", { autoplay: 1, controls: 0 })))).toMatchObject({
      autoplay: "1",
      controls: "0",
    })
  })

  it("keeps the embed's blockquote and drops scripts", async () => {
    const html = await tiktokAdapter.sanitize(
      '<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@u/video/1" data-video-id="1"><section><a target="_blank" title="@u" href="https://www.tiktok.com/@u">@u</a></section></blockquote><script async src="https://www.tiktok.com/embed.js"></script>',
    )

    expect(html).toBe(
      '<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@u/video/1" data-video-id="1"><section><a target="_blank" title="@u" href="https://www.tiktok.com/@u">@u</a></section></blockquote>',
    )
  })
})

describe("getOEmbed", () => {
  it.each([
    ["Twitter", fetchTwitterOEmbed, "Invalid Twitter/X post URL."],
    ["YouTube", fetchYouTubeOEmbed, "Invalid YouTube URL."],
    ["Reddit", fetchRedditOEmbed, "Invalid Reddit URL."],
    ["Bluesky", fetchBlueskyOEmbed, "Invalid Bluesky post URL."],
    ["TikTok", fetchTikTokOEmbed, "Invalid TikTok post URL."],
  ])("%s fails on an invalid URL without fetching", async (_, fetchOEmbed, message) => {
    const result = await fetchOEmbed({ url: "https://example.com/nope" })

    expect(result).toEqual({ success: false, error: new Error(message) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fetches the provider's oEmbed endpoint for a valid URL", async () => {
    fetchMock.mockResolvedValue(Response.json(rich))

    const result = await fetchTwitterOEmbed({ url: "https://x.com/a/status/1" })

    expect(result).toEqual({ success: true, value: rich })
    const [requested] = fetchMock.mock.calls[0] as [URL]
    expect(requested.toString()).toBe(
      twitterAdapter.buildUrl({ url: "https://x.com/a/status/1" }).toString(),
    )
  })
})
