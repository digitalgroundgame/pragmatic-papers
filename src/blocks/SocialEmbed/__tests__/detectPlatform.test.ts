// @vitest-environment node
import { describe, expect, it } from "vitest"

import { detectPlatform } from "../helpers/detectPlatform"

describe("detectPlatform", () => {
  it.each([
    ["https://twitter.com/jack/status/20", "twitter"],
    ["https://www.twitter.com/jack/status/20", "twitter"],
    ["https://mobile.twitter.com/jack/status/20", "twitter"],
    ["https://x.com/jack/status/20", "twitter"],
    ["https://www.x.com/jack/status/20", "twitter"],
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://m.youtube.com/watch?v=abc", "youtube"],
    ["https://youtu.be/abc", "youtube"],
    ["https://bsky.app/profile/a/post/1", "bluesky"],
    ["https://old.reddit.com/r/a/comments/1", "reddit"],
    ["https://amp.reddit.com/r/a", "reddit"],
    ["https://reddit.com/r/a", "reddit"],
    ["https://www.tiktok.com/@u/video/1", "tiktok"],
    ["https://m.tiktok.com/@u/video/1", "tiktok"],
    ["http://x.com/jack/status/20", "twitter"],
  ])("detects %s as %s", (url, platform) => {
    expect(detectPlatform(url)).toBe(platform)
  })

  it("ignores case and surrounding whitespace", () => {
    expect(detectPlatform("  HTTPS://WWW.YouTube.COM/watch?v=abc  ")).toBe("youtube")
  })

  it.each([
    "",
    "   ",
    "not a url",
    "twitter.com/jack/status/20",
    "ftp://twitter.com/jack",
    "javascript:alert(1)",
    "https://example.com",
    "https://evil-twitter.com/jack",
    "https://twitter.com.evil.com/jack",
    "https://www.bsky.app/profile/a",
    "https://vm.tiktok.com/abc",
    "https://www.youtu.be/abc",
  ])("returns null for %j", (input) => {
    expect(detectPlatform(input)).toBeNull()
  })
})
