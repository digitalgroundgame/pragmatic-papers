// @vitest-environment node
import type { SocialPlatform } from "@/payload-types"
import { describe, expect, it } from "vitest"

import { getPlatformDisplayName } from "../helpers/getPlatformDisplayName"

// The feed rendering that used this lives in `socialEmbedToHTML` (`../converters`),
// tested in `converters.test.ts`.
describe("getPlatformDisplayName", () => {
  it.each([
    ["twitter", "Twitter"],
    ["youtube", "YouTube"],
    ["bluesky", "Bluesky"],
    ["reddit", "Reddit"],
    ["tiktok", "TikTok"],
    ["mastodon", "Unknown"],
  ])("names %s as %s", (platform, name) => {
    expect(getPlatformDisplayName(platform as SocialPlatform)).toBe(name)
  })
})
