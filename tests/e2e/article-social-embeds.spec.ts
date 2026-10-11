import { expect, test, type Locator, type Page } from "@playwright/test"

import { SOCIAL_EMBEDS_SLUG } from "../../scripts/seed-e2e.constants"

// The e2e seed files the social-embeds demo article (src/endpoints/seed/
// features/social-embeds.ts) under SOCIAL_EMBEDS_SLUG: one embed per platform,
// each carrying a saved snapshot, so the server renders the wrapper without
// calling the platform. Only the wrapper is ours to test — every request off
// this site is aborted, so no third-party script or iframe content can make
// the run depend on the network (or on a post still existing). The fallbacks
// a failed embed shows are covered by the SocialEmbed stories.

const PLATFORMS: { name: string; wrapper: (page: Page) => Locator }[] = [
  // Snapshot markup rendered into a container keyed by the block's id.
  { name: "Bluesky", wrapper: (page) => page.locator("#seed-socialEmbed-bluesky") },
  { name: "Reddit", wrapper: (page) => page.locator("#seed-socialEmbed-reddit") },
  { name: "Twitter/X", wrapper: (page) => page.locator("#seed-socialEmbed-twitter") },
  // Players: an iframe pointed at the platform's embed URL.
  { name: "TikTok", wrapper: (page) => page.locator('iframe[src*="tiktok.com"]') },
  { name: "YouTube", wrapper: (page) => page.locator('iframe[src*="youtube.com/embed/"]') },
]

test("every platform's embed renders from its saved snapshot", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost:8000").origin
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  )
  await page.goto(`/articles/${SOCIAL_EMBEDS_SLUG}`)

  for (const { name, wrapper } of PLATFORMS) {
    await test.step(name, async () => {
      const embed = wrapper(page)
      await expect(embed).toHaveCount(1)
      await embed.scrollIntoViewIfNeeded()
      await expect(embed).toBeVisible()
    })
  }

  // EmbedError is the fallback every platform renders when it can't embed:
  // an alert card offering "Click to view on <platform>".
  await expect(page.getByText(/^Click to view on /)).toHaveCount(0)
  await expect(page.getByText("Social Media platform is not supported.")).toHaveCount(0)
})
