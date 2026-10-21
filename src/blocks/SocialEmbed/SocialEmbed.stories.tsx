import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, mocked, within } from "storybook/test"

import type { EmbedSnapshot, SocialEmbedSnapshot } from "@/payload-types"
import { getPayloadClient } from "@/data/payload"
import { FeedHTML } from "@/stories/FeedHTML"
import { createFakePayload } from "@/stories/fixtures/payload"
import { socialEmbedBlock } from "@/stories/fixtures/blocks"

import { SocialEmbedBlock } from "./Component"
import { embedKey } from "./helpers/embedKey"
import { socialEmbedToHTML } from "./converters"

const fetchedAt = new Date().toISOString()

const tweetHtml = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Turnout in yesterday's school board runoff: 9.8%. Every one of those votes counted about ten times over.</p>&mdash; County Clerk (@countyclerk) <a href="https://twitter.com/countyclerk/status/1">January 12, 2026</a></blockquote>`

const blueskyHtml = `<blockquote class="bluesky-embed"><p lang="en">New volume is up: seven articles on the offices that shape daily life.</p>&mdash; Pragmatic Papers (<a href="https://bsky.app/profile/example">@pragmaticpapers.bsky.social</a>) <a href="https://bsky.app/profile/example/post/1">January 11, 2026</a></blockquote>`

const youtubeHtml = `<iframe width="640" height="360" src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Video" frameborder="0" allowfullscreen></iframe>`

function snapshot(overrides: SocialEmbedSnapshot): SocialEmbedSnapshot {
  return { fetchedAt, ...overrides }
}

const meta = {
  title: "Blocks/SocialEmbed",
  component: SocialEmbedBlock,
  args: socialEmbedBlock,
  beforeEach: () => {
    mocked(getPayloadClient).mockResolvedValue(createFakePayload())
  },
} satisfies Meta<typeof SocialEmbedBlock>

export default meta
type Story = StoryObj<typeof meta>

/** The stored snapshot as readers see it before the platform's script upgrades it. */
export const TweetFallback: Story = {
  args: { snapshot: snapshot({ html: tweetHtml }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText(/Turnout in yesterday's school board runoff/),
    ).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "January 12, 2026" })).toHaveAttribute(
      "href",
      "https://twitter.com/countyclerk/status/1",
    )
  },
}

export const BlueskyFallback: Story = {
  args: {
    platform: "bluesky",
    url: "https://bsky.app/profile/example/post/1",
    snapshot: snapshot({ html: blueskyHtml }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/New volume is up/)).toBeInTheDocument()
    await expect(canvas.getByRole("link", { name: "January 11, 2026" })).toHaveAttribute(
      "href",
      "https://bsky.app/profile/example/post/1",
    )
  },
}

export const Unavailable: Story = {
  args: {
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=gone",
    snapshot: snapshot({ status: "not_found" }),
  },
  play: async ({ canvasElement }) => {
    const alert = await within(canvasElement).findByRole("alert")
    await expect(alert).toHaveTextContent("This video is unavailable.")
    await expect(within(alert).getByRole("link")).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=gone",
    )
  },
}

const goneVideo = { platform: "youtube" as const, url: "https://www.youtube.com/watch?v=removed" }

const goneVideoRefresh: EmbedSnapshot = {
  id: 1,
  key: embedKey(goneVideo),
  ...goneVideo,
  snapshot: { status: "not_found", fetchedAt: "2026-03-01T00:00:00.000Z" },
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
}

/**
 * The article saved the video while it was up; the daily refresh since found it removed. The
 * page shows the refresh, without the article being rewritten.
 */
export const RefreshedSnapshot: Story = {
  args: {
    ...goneVideo,
    snapshot: snapshot({ status: "ok", html: youtubeHtml, fetchedAt: "2026-01-01T00:00:00.000Z" }),
  },
  beforeEach: () => {
    mocked(getPayloadClient).mockResolvedValue(
      createFakePayload({
        collections: {
          "embed-snapshots": [goneVideoRefresh],
        },
      }),
    )
  },
  play: async ({ canvasElement }) => {
    const alert = await within(canvasElement).findByRole("alert")
    await expect(alert).toHaveTextContent("This video is unavailable.")
    await expect(canvasElement.querySelector("iframe")).not.toBeInTheDocument()
  },
}

export const UnsupportedPlatform: Story = {
  args: {
    platform: "myspace" as never,
    url: "https://myspace.com/example",
  },
  play: async ({ canvasElement }) => {
    const alert = await within(canvasElement).findByRole("alert")
    await expect(alert).toHaveTextContent("Social Media platform is not supported.")
    await expect(within(alert).getByRole("link")).toHaveAttribute(
      "href",
      "https://myspace.com/example",
    )
  },
}

/** The embed in the feeds: a link to the post, since feeds can't run the platform's script. */
export const Feed: Story = {
  render: (args) => <FeedHTML html={socialEmbedToHTML(args)} />,
  play: async ({ args, canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("link", { name: "View post on Twitter" }),
    ).toHaveAttribute("href", args.url)
  },
}

/** Loads the platform's own script, so it stays out of the test run. */
export const LiveTweet: Story = {
  tags: ["!test"],
  args: { snapshot: snapshot({ status: "ok", html: tweetHtml }) },
}

export const LiveYouTube: Story = {
  tags: ["!test"],
  args: {
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    snapshot: snapshot({ status: "ok", html: youtubeHtml }),
  },
}
