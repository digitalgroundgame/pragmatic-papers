// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { isValidElement, type ReactElement } from "react"

// Rendering an embed must never reach the database. Importing Payload would fail here.
vi.mock("@/data/payload", () => {
  throw new Error("SocialEmbedBlock must not import Payload")
})

import type {
  SocialEmbedBlock as SocialEmbedBlockProps,
  SocialEmbedSnapshot,
} from "@/payload-types"

import { SocialEmbedBlock } from "../Component"
import { BlueskyEmbedBlock } from "../embeds/BlueskyEmbed"
import { RedditEmbedBlock } from "../embeds/RedditEmbed"
import { TikTokEmbedBlock } from "../embeds/TikTokEmbed"
import { TwitterEmbedBlock } from "../embeds/TwitterEmbed"
import { YouTubeEmbedBlock } from "../embeds/YouTubeEmbed"

/** Saved two years ago, when the post was up. */
const stale: SocialEmbedSnapshot = {
  status: "ok",
  fetchedAt: "2024-01-01T00:00:00.000Z",
  html: "<blockquote><p>saved post</p></blockquote>",
}

const block = (
  platform: SocialEmbedBlockProps["platform"],
  url: string,
): SocialEmbedBlockProps => ({
  blockType: "socialEmbed",
  id: `embed-${platform}`,
  platform,
  url,
  snapshot: stale,
})

const cases = [
  {
    platform: "twitter",
    props: block("twitter", "https://x.com/a/status/1"),
    Embed: TwitterEmbedBlock,
  },
  {
    platform: "bluesky",
    props: block("bluesky", "https://bsky.app/profile/a/post/1"),
    Embed: BlueskyEmbedBlock,
  },
  {
    platform: "reddit",
    props: block("reddit", "https://www.reddit.com/r/a/comments/1/b/"),
    Embed: RedditEmbedBlock,
  },
  {
    platform: "tiktok",
    props: block("tiktok", "https://www.tiktok.com/@a/video/1234567890"),
    Embed: TikTokEmbedBlock,
  },
  {
    platform: "youtube",
    props: block("youtube", "https://www.youtube.com/watch?v=abc"),
    Embed: YouTubeEmbedBlock,
  },
] as const

afterEach(() => {
  vi.restoreAllMocks()
})

describe("SocialEmbedBlock", () => {
  it.each(cases)("hands $platform its saved snapshot, however old", ({ props, Embed }) => {
    const element = SocialEmbedBlock(props) as ReactElement<SocialEmbedBlockProps>
    expect(isValidElement(element)).toBe(true)
    expect(element.type).toBe(Embed)
    expect(element.props.snapshot).toBe(stale)
  })

  it.each(cases)(
    "renders $platform's stale snapshot without fetching",
    async ({ props, Embed }) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
      await (Embed as (p: SocialEmbedBlockProps) => Promise<React.ReactNode>)(props)
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )
})
