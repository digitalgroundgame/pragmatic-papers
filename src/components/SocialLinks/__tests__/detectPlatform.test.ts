import { describe, expect, it } from "vitest"

import { detectSocialLinkPlatform } from "../detectPlatform"

describe("detectSocialLinkPlatform", () => {
  it.each([
    // twitter / x
    ["https://twitter.com/example", "twitter"],
    ["https://www.twitter.com/example", "twitter"],
    ["https://x.com/example", "twitter"],
    // instagram
    ["https://instagram.com/example", "instagram"],
    ["https://www.instagram.com/example", "instagram"],
    // youtube variants
    ["https://youtube.com/@example", "youtube"],
    ["https://www.youtube.com/channel/UC1234567890", "youtube"],
    ["https://m.youtube.com/user/example", "youtube"],
    ["https://music.youtube.com/channel/UC1234567890", "youtube"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    // twitch
    ["https://twitch.tv/example", "twitch"],
    ["https://www.twitch.tv/example", "twitch"],
    ["https://m.twitch.tv/example", "twitch"],
    // discord
    ["https://discord.gg/abc123", "discord"],
    ["https://discord.com/invite/abc123", "discord"],
    ["https://www.discord.com/invite/abc123", "discord"],
    ["https://discordapp.com/invite/abc123", "discord"],
    // github
    ["https://github.com/example", "github"],
    ["https://www.github.com/example", "github"],
    // linkedin
    ["https://linkedin.com/in/example", "linkedin"],
    ["https://www.linkedin.com/in/example", "linkedin"],
  ])("detects %s as %s", (input, expected) => {
    expect(detectSocialLinkPlatform(input)).toBe(expected)
  })

  it.each([
    ["https://example.com"],
    ["https://not-a-real-social.example/example"],
    ["mailto:someone@example.com"],
    ["ftp://twitter.com/example"],
    ["not a url"],
    [""],
  ])("returns null for unrecognized/invalid input %s", (input) => {
    expect(detectSocialLinkPlatform(input)).toBeNull()
  })
})
