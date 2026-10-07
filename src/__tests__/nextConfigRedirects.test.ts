// @vitest-environment node
import { buildCustomRoute } from "next/dist/lib/build-custom-route"
import type { Redirect } from "next/dist/lib/load-custom-routes"
import { describe, expect, it } from "vitest"

import nextConfig from "../../next.config"

// The first redirect next.config.ts applies to a path, matched the way Next builds
// them (buildCustomRoute). Rules with a `has` condition (the IE redirect, which
// needs a Trident user agent) are skipped: an ordinary browser never meets them.
const redirectFor = async (path: string) => {
  for (const rule of (await nextConfig.redirects?.()) ?? []) {
    if (rule.has?.length) continue
    // Next never redirects its own `/_next` assets (see its build's `restrictedRedirectPaths`).
    const { regex } = buildCustomRoute("redirect", rule as Redirect, ["/_next"])
    if (new RegExp(regex).test(path)) return rule
  }
  return undefined
}

describe("next.config.ts redirects", () => {
  // #1046: the RSS feeds moved under the section they list.
  it.each([
    ["/feed.articles", "/articles/feed.xml"],
    ["/feed.volumes", "/volumes/feed.xml"],
  ])("permanently redirects the old feed URL %s to %s", async (from, to) => {
    const rule = await redirectFor(from)
    expect(rule?.destination).toBe(to)
    expect(rule?.permanent).toBe(true)
  })

  it("leaves the new feed URLs alone", async () => {
    expect(await redirectFor("/articles/feed.xml")).toBeUndefined()
    expect(await redirectFor("/volumes/feed.xml")).toBeUndefined()
  })
})
