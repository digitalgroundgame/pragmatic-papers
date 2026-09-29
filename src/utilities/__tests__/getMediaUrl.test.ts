import { describe, expect, it } from "vitest"

import { getMediaUrl } from "@/utilities/getMediaUrl"

const UPDATED_AT = "2024-06-20T12:00:00.000Z"

describe("getMediaUrl", () => {
  it.each([null, undefined, ""])("returns an empty string for %j", (url) => {
    expect(getMediaUrl(url)).toBe("")
    expect(getMediaUrl(url, UPDATED_AT)).toBe("")
  })

  describe("absolute urls", () => {
    it.each(["https://cdn.example.com/media/hero.jpg", "http://cdn.example.com/media/hero.jpg"])(
      "appends the cache tag to %s",
      (url) => {
        expect(getMediaUrl(url, UPDATED_AT)).toBe(`${url}?${UPDATED_AT}`)
      },
    )

    it.each([undefined, null, ""])("leaves the url alone when the cache tag is %j", (tag) => {
      expect(getMediaUrl("https://cdn.example.com/media/hero.jpg", tag)).toBe(
        "https://cdn.example.com/media/hero.jpg",
      )
    })
  })

  describe("relative urls", () => {
    it("returns the path unchanged and drops the cache tag", () => {
      expect(getMediaUrl("/api/media/file/hero.jpg", UPDATED_AT)).toBe("/api/media/file/hero.jpg")
    })

    it("does not mistake a path that mentions http for an absolute url", () => {
      expect(getMediaUrl("/media/http-status.png", UPDATED_AT)).toBe("/media/http-status.png")
    })
  })
})
