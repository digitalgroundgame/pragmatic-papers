// @vitest-environment node
import { buildCustomRoute } from "next/dist/lib/build-custom-route"
import { describe, expect, it } from "vitest"

import nextConfig from "../../next.config"

// The Cache-Control a path gets from next.config.ts, with the headers() rules matched the
// way Next builds them (buildCustomRoute) and the last matching rule winning. Requests
// without cookies, as Cloudflare sees an anonymous visitor.
const cacheControlFor = async (path: string): Promise<string | undefined> => {
  let value: string | undefined
  for (const rule of (await nextConfig.headers?.()) ?? []) {
    const { regex } = buildCustomRoute("header", rule)
    if (!new RegExp(regex).test(path)) continue
    value = rule.headers.find((header) => header.key === "Cache-Control")?.value ?? value
  }
  return value
}

describe("next.config.ts Cache-Control", () => {
  // The optimizer sets its own Cache-Control on images it serves and none on errors, so a
  // config header here would only ever reach errors, such as a 400 for a missing media
  // file, and Cloudflare kept those for up to a day after the file came back.
  it("leaves the image optimizer to set its own", async () => {
    expect(await cacheControlFor("/_next/image")).toBeUndefined()
  })

  it("still caches public pages at the edge", async () => {
    for (const path of ["/", "/articles/some-article", "/robots.txt", "/_next/image-like-page"]) {
      expect(await cacheControlFor(path)).toBe("public, s-maxage=600, stale-while-revalidate=86400")
    }
  })
})
