import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"

import type { SocialEmbedSnapshot } from "@/payload-types"
import { FeedHTML } from "@/stories/FeedHTML"
import { socialEmbedBlock } from "@/stories/fixtures/blocks"

import { SocialEmbedBlock } from "./Component"
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
} satisfies Meta<typeof SocialEmbedBlock>

export default meta
type Story = StoryObj<typeof meta>

/** The stored snapshot as readers see it before the platform's script upgrades it. */
export const TweetFallback: Story = {
  args: { snapshot: snapshot({ html: tweetHtml }) },
}

export const BlueskyFallback: Story = {
  args: {
    platform: "bluesky",
    url: "https://bsky.app/profile/example/post/1",
    snapshot: snapshot({ html: blueskyHtml }),
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

export const UnsupportedPlatform: Story = {
  args: {
    platform: "myspace" as never,
    url: "https://myspace.com/example",
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
