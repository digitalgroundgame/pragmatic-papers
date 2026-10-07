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

  // Both have their own no-store rule, which the public-page rule used to override for
  // requests without Payload's cookies, since it comes after them and the last match wins.
  it("never lets a shared cache keep the admin panel or the API", async () => {
    for (const path of [
      "/admin",
      "/admin/login",
      "/admin/collections/articles/1",
      "/api/users/me",
      "/api/newsletter/subscribe",
      "/api/media",
      "/api/media/1",
    ]) {
      expect(await cacheControlFor(path)).toBe("private, no-cache, no-store, must-revalidate")
    }
  })

  // Route Handlers that set their own Cache-Control: a config header for the same key would
  // replace it, so none of these may match a Cache-Control rule at all.
  it("leaves routes that set their own Cache-Control alone", async () => {
    for (const path of [
      "/interactives/federal-courts/regions/ca1",
      "/interactives/federal-courts/regions/ca1/geometry/abc123",
      "/interactives/federal-courts/search",
      "/articles/feed.xml",
      "/volumes/feed.xml",
      "/feed.articles",
      "/feed.volumes",
      "/articles/substack.xml",
      "/articles/some-article/substack.xml",
      "/recommended-articles.json",
    ]) {
      expect(await cacheControlFor(path)).toBeUndefined()
    }
  })

  it("still caches public pages at the edge", async () => {
    for (const path of [
      "/",
      "/articles/some-article",
      "/interactives/federal-courts",
      "/interactives/federal-courts/searching",
      "/feed.articles.bak",
      "/feedback",
      "/recommended-articles",
      "/robots.txt",
      "/_next/image-like-page",
      "/apiary",
      "/administration",
      // Upload files, which local storage serves from /api and anyone can read.
      "/api/media/file/hero.jpg",
      "/api/map-assets/file/counties.svg",
    ]) {
      expect(await cacheControlFor(path)).toBe("public, s-maxage=600, stale-while-revalidate=86400")
    }
  })
})

describe("next.config.ts client hints", () => {
  // Every header a path gets from next.config.ts, with later rules overriding earlier ones.
  const headersFor = async (path: string): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {}
    for (const rule of (await nextConfig.headers?.()) ?? []) {
      const { regex } = buildCustomRoute("header", rule)
      if (!new RegExp(regex).test(path)) continue
      for (const { key, value } of rule.headers) headers[key] = value
    }
    return headers
  }

  // Critical-CH makes Chrome restart a first visit's navigation to send the hint, which costs
  // public pages a round trip for a theme only Payload's admin panel reads.
  it("doesn't ask readers' browsers for the color-scheme hint", async () => {
    for (const path of ["/", "/articles/some-article", "/volumes/1", "/api/users/me"]) {
      const headers = await headersFor(path)
      expect(headers).not.toHaveProperty("Critical-CH")
      expect(headers).not.toHaveProperty("Accept-CH")
      expect(headers["Vary"]).toBeUndefined()
    }
  })

  it("still asks for it on the admin panel, which themes itself by it", async () => {
    for (const path of ["/admin", "/admin/login", "/admin/collections/articles/1"]) {
      expect(await headersFor(path)).toMatchObject({
        "Accept-CH": "Sec-CH-Prefers-Color-Scheme",
        "Critical-CH": "Sec-CH-Prefers-Color-Scheme",
        Vary: "Sec-CH-Prefers-Color-Scheme",
      })
    }
  })

  it("keeps Payload's other headers on every path", async () => {
    expect(await headersFor("/")).toHaveProperty("X-Powered-By")
  })
})
