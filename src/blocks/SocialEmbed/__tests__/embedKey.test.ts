// @vitest-environment node
import { describe, expect, it } from "vitest"

import { embedKey } from "../helpers/embedKey"

describe("embedKey", () => {
  const tweet = { platform: "twitter" as const, url: "https://x.com/a/status/1" }

  it("names the post and, on Twitter, the display options", () => {
    expect(embedKey(tweet)).toBe("twitter|https://x.com/a/status/1|media:true|thread:true")
    expect(embedKey({ ...tweet, hideMedia: true, hideThread: true })).toBe(
      "twitter|https://x.com/a/status/1|media:false|thread:false",
    )
  })

  it("treats an unset option as off", () => {
    expect(embedKey({ ...tweet, hideMedia: null })).toBe(embedKey({ ...tweet, hideMedia: false }))
  })

  it("ignores the Twitter options on other platforms", () => {
    const video = { platform: "youtube" as const, url: "https://youtu.be/x" }
    expect(embedKey({ ...video, hideMedia: true })).toBe("youtube|https://youtu.be/x")
  })

  it("trims the URL, so a pasted space doesn't make a second row", () => {
    expect(embedKey({ ...tweet, url: ` ${tweet.url} ` })).toBe(embedKey(tweet))
  })
})
