import { Globe } from "lucide-react"
import { describe, expect, it } from "vitest"

import type { SocialLinkPlatform } from "../detectPlatform"
import {
  BlueskyIcon,
  DiscordIcon,
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  RedditIcon,
  SubstackIcon,
  TiktokIcon,
  TwitchIcon,
  XIcon,
  YoutubeIcon,
} from "../icons"
import { socialIconMap, type SocialIconKey } from "../iconMap"

describe("socialIconMap", () => {
  it.each<[SocialIconKey, unknown]>([
    ["twitter", XIcon],
    ["instagram", InstagramIcon],
    ["reddit", RedditIcon],
    ["bluesky", BlueskyIcon],
    ["substack", SubstackIcon],
    ["youtube", YoutubeIcon],
    ["tiktok", TiktokIcon],
    ["twitch", TwitchIcon],
    ["discord", DiscordIcon],
    ["github", GithubIcon],
    ["linkedin", LinkedinIcon],
    ["generic", Globe],
  ])("maps %s to its icon component", (key, Icon) => {
    expect(socialIconMap[key]).toBe(Icon)
  })

  it("has an icon for every social platform (no generic fallback gaps)", () => {
    const platforms: SocialLinkPlatform[] = [
      "bluesky",
      "discord",
      "github",
      "instagram",
      "linkedin",
      "reddit",
      "substack",
      "tiktok",
      "twitch",
      "twitter",
      "youtube",
    ]
    for (const platform of platforms) {
      expect(socialIconMap[platform]).toBeDefined()
      expect(socialIconMap[platform]).not.toBe(Globe)
    }
  })
})
