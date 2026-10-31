// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

import {
  afterCachedSite,
  edgeCacheTags,
  goesToCachedSite,
  isEdgeCacheable,
  REVALIDATE_ALL_PATH,
  withEdgeCache,
  withServerTiming,
} from "../edgeCache"
import type { WorkerEnv } from "../origin"

const W = "https://w.dev"
const PUBLIC = { "Cache-Control": "public, s-maxage=600", "CDN-Cache-Control": "max-age=600" }

describe("isEdgeCacheable", () => {
  it.each(["/", "/articles/a", "/topics?page=2", "/_next/image?url=%2Fa.png&w=640&q=75"])(
    "caches an anonymous GET of %s",
    (path) => expect(isEdgeCacheable(new Request(`${W}${path}`))).toBe(true),
  )

  it("caches HEAD, and requests with unrelated cookies", () => {
    expect(isEdgeCacheable(new Request(`${W}/`, { method: "HEAD" }))).toBe(true)
    const cookies = { headers: { Cookie: "theme=dark; _ga=GA1.2" } }
    expect(isEdgeCacheable(new Request(`${W}/`, cookies))).toBe(true)
  })

  it.each([
    ["Payload's login", { Cookie: "theme=dark; payload-token=abc" }],
    ["staff's single sign-on", { Cookie: "pp-session=abc; payload-token-sso=1" }],
    ["draft mode", { Cookie: "__prerender_bypass=abc" }],
    ["an Authorization header", { Authorization: "Bearer secret" }],
    ["OpenNext's revalidation", { "x-prerender-revalidate": "id", "x-isr": "1" }],
    ["a navigation", { RSC: "1" }],
    ["a WebSocket", { Upgrade: "websocket" }],
    ["a Server Action", { "Next-Action": "x" }],
  ])("skips %s", (_, headers) => {
    expect(isEdgeCacheable(new Request(`${W}/articles/a`, { headers }))).toBe(false)
  })

  it("skips a navigation's _rsc URL, other methods, and what Coolify serves", () => {
    expect(isEdgeCacheable(new Request(`${W}/articles/a?_rsc=abc`))).toBe(false)
    expect(isEdgeCacheable(new Request(`${W}/feed`, { method: "POST" }))).toBe(false)
    expect(isEdgeCacheable(new Request(`${W}/admin`))).toBe(false)
    expect(isEdgeCacheable(new Request(`${W}/api/media/file/a.png`))).toBe(false)
  })

  it("caches pages for a signed-in member, whose session isn't personal to a page", () => {
    const headers = { Cookie: "pp-session=abc" }
    expect(isEdgeCacheable(new Request(`${W}/articles/a`, { headers }))).toBe(true)
  })

  it("doesn't mistake a cookie that only ends in a personal name", () => {
    const headers = { Cookie: "not-payload-token=abc" }
    expect(isEdgeCacheable(new Request(`${W}/`, { headers }))).toBe(true)
  })
})

describe("goesToCachedSite", () => {
  it("sends /next/revalidate-all there too, so its purge reaches the cache", () => {
    const revalidate = new Request(`${W}${REVALIDATE_ALL_PATH}`, { method: "POST" })
    expect(goesToCachedSite(revalidate)).toBe(true)
    expect(goesToCachedSite(new Request(`${W}/next/version`, { method: "POST" }))).toBe(false)
  })
})

describe("afterCachedSite", () => {
  const revalidate = () => new Request(`${W}${REVALIDATE_ALL_PATH}`, { method: "POST" })

  it("keeps a page's caching, tagged with its path", async () => {
    const page = new Response("page", { headers: { "CDN-Cache-Control": "max-age=600" } })
    const response = await afterCachedSite(new Request(`${W}/articles/a?x=1`), page, undefined)
    expect(response.headers.get("CDN-Cache-Control")).toBe("max-age=600")
    expect(response.headers.get("Cache-Tag")).toBe("path:/articles/a")
    expect(await response.text()).toBe("page")
  })

  it("doesn't keep an error", async () => {
    const error = new Response("down", {
      status: 500,
      headers: {
        "Cache-Control": "public, s-maxage=600",
        "CDN-Cache-Control": "max-age=600",
      },
    })
    const response = await afterCachedSite(new Request(`${W}/`), error, undefined)
    expect(response.status).toBe(500)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.has("cdn-cache-control")).toBe(false)
    expect(await response.text()).toBe("down")
  })

  it.each([
    ["an empty 404", new Response(null, { status: 404 })],
    ["a 200 without caching headers", new Response("page")],
    ["a 404 the app marked public", new Response("gone", { status: 404, headers: PUBLIC })],
  ])("doesn't keep %s", async (_, answer) => {
    const response = await afterCachedSite(new Request(`${W}/articles/a`), answer, undefined)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.has("cdn-cache-control")).toBe(false)
  })

  it("keeps a redirect the app gave caching headers", async () => {
    const redirect = new Response(null, {
      status: 308,
      headers: { ...PUBLIC, Location: `${W}/contributors` },
    })
    const response = await afterCachedSite(new Request(`${W}/authors`), redirect, undefined)
    expect(response.status).toBe(308)
    expect(response.headers.get("Location")).toBe(`${W}/contributors`)
    expect(response.headers.get("CDN-Cache-Control")).toBe("max-age=600")
  })

  it("purges the cache after a successful revalidate-all", async () => {
    const purge = vi.fn(async () => ({ success: true }))
    await afterCachedSite(revalidate(), new Response("ok"), { purge })
    expect(purge).toHaveBeenCalledWith({ purgeEverything: true })
  })

  it("purges only the paths a revalidate-all names, with the pages beneath them", async () => {
    const purge = vi.fn(async () => ({ success: true }))
    const named = new Request(
      `${W}${REVALIDATE_ALL_PATH}?path=/interactives/a&path=/docs/b/&path=nope&shared=1`,
      { method: "POST" },
    )
    await afterCachedSite(named, new Response("ok"), { purge })
    expect(purge).toHaveBeenCalledExactlyOnceWith({
      tags: [
        "path:/interactives/a",
        "within:/interactives/a",
        "path:/docs/b",
        "within:/docs/b",
        "shared",
      ],
    })
  })

  it("purges many tags in batches", async () => {
    const purge = vi.fn(async (_options: { purgeEverything: true } | { tags: string[] }) => ({
      success: true,
    }))
    const query = Array.from({ length: 20 }, (_, i) => `path=/articles/a${i}`).join("&")
    const named = new Request(`${W}${REVALIDATE_ALL_PATH}?${query}`, { method: "POST" })
    await afterCachedSite(named, new Response("ok"), { purge })
    expect(purge).toHaveBeenCalledTimes(2)
    const sent = purge.mock.calls.flatMap(([options]) => ("tags" in options ? options.tags : []))
    expect(sent).toHaveLength(40)
  })

  it("doesn't purge when revalidate-all was refused", async () => {
    const purge = vi.fn(async () => ({ success: true }))
    await afterCachedSite(revalidate(), new Response("no", { status: 401 }), { purge })
    expect(purge).not.toHaveBeenCalled()
  })

  it("logs, and still answers, when the purge fails or isn't there", async () => {
    const log = { warn: vi.fn() }
    const failing = { purge: vi.fn(async () => Promise.reject(new Error("rate limited"))) }
    const ok = await afterCachedSite(revalidate(), new Response("ok"), failing, log)
    expect(await ok.text()).toBe("ok")
    await afterCachedSite(revalidate(), new Response("ok"), {}, log)
    expect(log.warn).toHaveBeenCalledTimes(2)
  })

  it("logs a purge Cloudflare refused, which resolves rather than throws", async () => {
    const log = { warn: vi.fn() }
    const errors = [{ code: 1015, message: "rate limited" }]
    const refused = { purge: vi.fn(async () => ({ success: false, errors })) }
    const ok = await afterCachedSite(revalidate(), new Response("ok"), refused, log)
    expect(await ok.text()).toBe("ok")
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("refused"), errors)
  })
})

describe("edgeCacheTags", () => {
  it.each([
    ["/", ["path:/", "shared"]],
    ["/about", ["path:/about", "shared"]],
    ["/articles", ["path:/articles", "shared"]],
    ["/articles/feed.xml", ["path:/articles/feed.xml", "shared"]],
    ["/topics/politics", ["path:/topics/politics", "shared"]],
    ["/contributors/jane/", ["path:/contributors/jane", "shared"]],
    ["/articles/a", ["path:/articles/a"]],
    ["/articles/a/substack.xml", ["path:/articles/a/substack.xml", "within:/articles/a"]],
    ["/volumes/12", ["path:/volumes/12"]],
    ["/docs", ["path:/docs", "within:/docs"]],
    ["/docs/whats-new", ["path:/docs/whats-new", "within:/docs"]],
    ["/interactives/a/regions/x", ["path:/interactives/a/regions/x", "within:/interactives/a"]],
    ["/_next/image", ["path:/_next/image"]],
  ])("tags %s", (path, tags) => {
    expect(edgeCacheTags(path)).toEqual(tags)
  })
})

describe("withEdgeCache", () => {
  const env: WorkerEnv = { ASSETS: { fetch: async () => new Response("asset") } }
  const site = { fetch: vi.fn(async () => new Response("rendered")) }
  const cachedSite = { fetch: vi.fn(async () => new Response("cached")) }
  const gateway = withEdgeCache(site)
  const ctx = { exports: { CachedSite: cachedSite } }

  it("sends what the cache may hold through CachedSite", async () => {
    const response = await gateway.fetch(new Request(`${W}/articles/a`), env, ctx)
    expect(await response.text()).toBe("cached")
  })

  it("renders drafts and navigations itself", async () => {
    const draft = new Request(`${W}/articles/a`, { headers: { Cookie: "__prerender_bypass=x" } })
    expect(await (await gateway.fetch(draft, env, ctx)).text()).toBe("rendered")
    const nav = new Request(`${W}/articles/a?_rsc=abc`, { headers: { RSC: "1" } })
    expect(await (await gateway.fetch(nav, env, ctx)).text()).toBe("rendered")
  })

  it("renders everything itself without ctx.exports", async () => {
    const response = await gateway.fetch(new Request(`${W}/articles/a`), env, {})
    expect(await response.text()).toBe("rendered")
  })
})

describe("withServerTiming", () => {
  const timing = (response: Response) => response.headers.get("Server-Timing")

  it("says how long the entrypoint ran, where, and on which isolate request", async () => {
    const request = Object.assign(new Request(`${W}/`), { cf: { colo: "LAX" } })
    const page = new Response("page", { headers: PUBLIC })
    const first = withServerTiming(request, page, 1000, 1140)
    const second = withServerTiming(request, new Response("page"), 2000, 2010)

    const count = Number(/isolate request (\d+)/.exec(timing(first) ?? "")?.[1])
    expect(timing(first)).toBe(`cached-site;dur=140;desc="LAX, isolate request ${count}"`)
    expect(timing(second)).toBe(`cached-site;dur=10;desc="LAX, isolate request ${count + 1}"`)
    expect(first.headers.get("CDN-Cache-Control")).toBe("max-age=600")
    expect(await first.text()).toBe("page")
  })

  it("counts the requests the gateway runs itself", async () => {
    const request = new Request(`${W}/`)
    const count = (response: Response) =>
      Number(/isolate request (\d+)/.exec(timing(response) ?? "")?.[1])
    const before = count(withServerTiming(request, new Response(), 0, 0))
    const env: WorkerEnv = { ASSETS: { fetch: async () => new Response("asset") } }
    const site = { fetch: vi.fn(async () => new Response("nav")) }
    await withEdgeCache(site).fetch(new Request(`${W}/a`, { headers: { RSC: "1" } }), env, {})
    const after = withServerTiming(request, new Response(), 0, 0)
    expect(timing(after)).toContain(`isolate request ${before + 2}`)
  })

  it("keeps the app's own Server-Timing and names an unknown data center", () => {
    const answer = new Response("page", { headers: { "Server-Timing": "db;dur=5" } })
    const timed = withServerTiming(new Request(`${W}/`), answer, 0, 0)
    expect(timing(timed)).toMatch(
      /^db;dur=5, cached-site;dur=0;desc="unknown, isolate request \d+"$/,
    )
  })
})
