// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { SocialEmbedBlock } from "@/payload-types"

import { TikTokEmbedBlock } from "../embeds/TikTokEmbed"

const URL = "https://www.tiktok.com/@pragmatic/video/7301234567890123456"

async function render(props: Partial<SocialEmbedBlock>): Promise<string> {
  const node = await TikTokEmbedBlock({
    blockType: "socialEmbed",
    platform: "tiktok",
    url: URL,
    ...props,
  })
  return renderToStaticMarkup(<>{node}</>)
}

describe("TikTokEmbedBlock", () => {
  it("embeds the player for a post that fetched", async () => {
    const html = await render({
      snapshot: { status: "ok", title: "Turnout explained", authorName: "@pragmatic" },
    })
    expect(html).toContain('src="https://www.tiktok.com/player/v1/7301234567890123456')
    expect(html).toContain('title="Turnout explained"')
    expect(html).toContain("@pragmatic")
    expect(html).toContain(`href="${URL}"`)
  })

  it("names the iframe generically when the snapshot has no title", async () => {
    expect(await render({})).toContain('title="TikTok video"')
  })

  it("shows the saved markup when the post is gone but its markup was kept", async () => {
    const html = await render({
      snapshot: { status: "not_found", html: "<blockquote>saved caption</blockquote>" },
    })
    expect(html).toContain("<blockquote>saved caption</blockquote>")
    expect(html).not.toContain("<iframe")
  })

  it("says the post is unavailable when there's no markup to fall back on", async () => {
    const html = await render({ snapshot: { status: "forbidden" } })
    expect(html).toContain("This post is unavailable or no longer embeddable.")
    expect(html).not.toContain("<iframe")
  })

  it("rejects a URL with no video id", async () => {
    const html = await render({ url: "https://www.tiktok.com/@pragmatic" })
    expect(html).toContain("Invalid URL")
    expect(html).not.toContain("<iframe")
  })
})
