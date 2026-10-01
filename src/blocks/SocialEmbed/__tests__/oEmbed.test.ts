// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  isOEmbed,
  isOEmbedLink,
  isOEmbedPhoto,
  isOEmbedRich,
  isOEmbedThumbnail,
  isOEmbedVideo,
  type OEmbedResponse,
} from "../helpers/oEmbed"

const photo = { type: "photo", version: "1.0", url: "u", width: 1, height: 1 } as const
const video = { type: "video", version: "1.0", html: "<iframe>", width: 1, height: 1 } as const
const rich = { type: "rich", version: "1.0", html: "<blockquote>", width: 1, height: 1 } as const
const link = { type: "link", version: "1.0" } as const

describe("oEmbed type guards", () => {
  it("tells each resource type apart", () => {
    expect([photo, video, rich, link].map(isOEmbedPhoto)).toEqual([true, false, false, false])
    expect([photo, video, rich, link].map(isOEmbedVideo)).toEqual([false, true, false, false])
    expect([photo, video, rich, link].map(isOEmbedRich)).toEqual([false, false, true, false])
    expect([photo, video, rich, link].map(isOEmbedLink)).toEqual([false, false, false, true])
  })

  it("requires html on video and rich responses", () => {
    expect(isOEmbedVideo({ type: "video", version: "1.0" } as OEmbedResponse)).toBe(false)
    expect(isOEmbedRich({ type: "rich", version: "1.0" } as OEmbedResponse)).toBe(false)
  })

  it("accepts any known resource type and rejects everything else", () => {
    expect([photo, video, rich, link].every(isOEmbed)).toBe(true)
    expect(isOEmbed({ type: "audio", version: "1.0" })).toBe(false)
    expect(isOEmbed(null)).toBe(false)
    expect(isOEmbed("rich")).toBe(false)
  })

  it("needs all three thumbnail fields to count as having a thumbnail", () => {
    expect(
      isOEmbedThumbnail({
        ...video,
        thumbnail_url: "t",
        thumbnail_width: 1,
        thumbnail_height: 1,
      }),
    ).toBe(true)
    expect(isOEmbedThumbnail({ ...video, thumbnail_url: "t" } as OEmbedResponse)).toBe(false)
    expect(isOEmbedThumbnail(video)).toBe(false)
  })
})
