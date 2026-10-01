// @vitest-environment node
import type { SocialEmbedBlock, SocialPlatform } from "@/payload-types"
import { describe, expect, it } from "vitest"

import { getPlatformDisplayName } from "../helpers/getPlatformDisplayName"
import { socialEmbedBlockToHTML } from "../helpers/socialEmbedBlockToHTML"

const toHTML = (fields: Partial<SocialEmbedBlock>) =>
  socialEmbedBlockToHTML({ node: { fields } as never })

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

describe("socialEmbedBlockToHTML", () => {
  it("renders a link to the post named after its platform", () => {
    expect(toHTML({ url: "https://x.com/a/status/1", platform: "twitter" })).toBe(
      '<blockquote><a href="https://x.com/a/status/1" target="_blank" rel="noopener noreferrer">View post on Twitter</a></blockquote>',
    )
  })

  it("falls back to a generic name without a platform", () => {
    expect(toHTML({ url: "https://example.com/post" })).toContain("View post on Social Media")
  })

  it("renders nothing without a URL", () => {
    expect(toHTML({ url: "", platform: "youtube" })).toBe("")
  })
})
