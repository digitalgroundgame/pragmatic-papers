// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isOriginPath,
  logErrorCauses,
  toOrigin,
  withCauses,
  withImageCaching,
  withOrigin,
  type WorkerEnv,
} from "../origin"

const ORIGIN = "https://staging.example.com"

describe("isOriginPath", () => {
  it.each(["/admin", "/admin/collections/articles", "/api/media/file/a.png", "/_next/static/x.js"])(
    "sends %s to the origin",
    (path) => expect(isOriginPath(path)).toBe(true),
  )

  it.each(["/", "/articles/a", "/administrators", "/apis", "/_next/image", "/next/revalidate-all"])(
    "serves %s from the Worker",
    (path) => expect(isOriginPath(path)).toBe(false),
  )
})

describe("toOrigin", () => {
  it("keeps the path, query, method and body, and doesn't follow redirects", async () => {
    const request = new Request("https://worker.example.dev/api/users/login?x=1", {
      method: "POST",
      body: "{}",
      headers: { cookie: "payload-token=t" },
    })
    const forwarded = toOrigin(request, ORIGIN)
    expect(forwarded.url).toBe(`${ORIGIN}/api/users/login?x=1`)
    expect(forwarded.method).toBe("POST")
    expect(forwarded.redirect).toBe("manual")
    expect(forwarded.headers.get("cookie")).toBe("payload-token=t")
    expect(forwarded.headers.get("x-forwarded-host")).toBe("worker.example.dev")
    expect(await forwarded.text()).toBe("{}")
  })
})

describe("withOrigin", () => {
  const fetchMock = vi.fn(async (request: Request) => new Response(`origin ${request.url}`))
  vi.stubGlobal("fetch", fetchMock)

  const assets = { fetch: vi.fn(async () => new Response("asset")) }
  const env = (extra: Partial<WorkerEnv> = {}): WorkerEnv => ({ ASSETS: assets, ...extra })
  const openNext = {
    fetch: vi.fn(async (request: Request, workerEnv: WorkerEnv) => {
      // Like OpenNext's image handler: a relative image is read through ASSETS.
      const image = new URL(request.url).searchParams.get("url")
      if (image) return workerEnv.ASSETS.fetch(new URL(image, request.url))
      return new Response("next")
    }),
  }
  const worker = withOrigin(openNext)
  afterEach(() => {
    fetchMock.mockClear()
    openNext.fetch.mockClear()
    Reflect.deleteProperty(process.env, "DATABASE_URI")
  })

  it("proxies the admin panel and Payload's API to the origin", async () => {
    const response = await worker.fetch(
      new Request("https://w.dev/admin/login"),
      env({ ORIGIN_URL: ORIGIN }),
      {},
    )
    expect(await response.text()).toBe(`origin ${ORIGIN}/admin/login`)
    expect(openNext.fetch).not.toHaveBeenCalled()
  })

  it("renders public pages with OpenNext", async () => {
    const response = await worker.fetch(
      new Request("https://w.dev/articles/a"),
      env({ ORIGIN_URL: ORIGIN }),
      {},
    )
    expect(await response.text()).toBe("next")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reads media for next/image from the origin, other assets from ASSETS", async () => {
    const media = await worker.fetch(
      new Request("https://w.dev/_next/image?url=%2Fapi%2Fmedia%2Ffile%2Fa.png&w=640&q=80"),
      env({ ORIGIN_URL: ORIGIN }),
      {},
    )
    expect(await media.text()).toBe(`origin ${ORIGIN}/api/media/file/a.png`)

    const local = await worker.fetch(
      new Request("https://w.dev/_next/image?url=%2Flogo.png&w=640&q=80"),
      env({ ORIGIN_URL: ORIGIN }),
      {},
    )
    expect(await local.text()).toBe("asset")
  })

  it("gives resized images Next's caching when OpenNext sets none", async () => {
    const image = await worker.fetch(
      new Request("https://w.dev/_next/image?url=%2Fapi%2Fmedia%2Ffile%2Fa.png&w=640&q=80"),
      env({ ORIGIN_URL: ORIGIN }),
      {},
    )
    expect(image.headers.get("cache-control")).toBe("public, max-age=14400, must-revalidate")
    expect(await image.text()).toBe(`origin ${ORIGIN}/api/media/file/a.png`)

    const page = await worker.fetch(
      new Request("https://w.dev/articles/a"),
      env({ ORIGIN_URL: ORIGIN }),
      {},
    )
    expect(page.headers.get("cache-control")).toBeNull()
  })

  it("leaves everything to OpenNext without ORIGIN_URL", async () => {
    const response = await worker.fetch(new Request("https://w.dev/api/users"), env(), {})
    expect(await response.text()).toBe("next")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("points Payload at Hyperdrive", async () => {
    await worker.fetch(
      new Request("https://w.dev/"),
      env({ HYPERDRIVE: { connectionString: "postgres://hyperdrive" } }),
      {},
    )
    expect(process.env.DATABASE_URI).toBe("postgres://hyperdrive")
  })
})

describe("withCauses", () => {
  it("adds each cause to an error's stack", () => {
    const error = new Error("Failed query", {
      cause: new Error('relation "pages" does not exist', { cause: "deeper" }),
    })
    const logged = withCauses(error)
    expect(logged).toContain("Failed query")
    expect(logged).toContain('Caused by: Error: relation "pages" does not exist')
    expect(logged).toContain("Caused by: deeper")
  })

  it("leaves anything else as it is", () => {
    const plain = new Error("plain")
    expect(withCauses(plain)).toBe(plain)
    expect(withCauses("text")).toBe("text")
  })
})

describe("logErrorCauses", () => {
  it("logs errors with their causes", () => {
    const error = vi.fn()
    const target = { error, warn: vi.fn() }
    logErrorCauses(target)
    target.error("rendering failed", new Error("outer", { cause: new Error("inner") }))
    expect(error).toHaveBeenCalledWith(
      "rendering failed",
      expect.stringContaining("Caused by: Error: inner"),
    )
  })
})

describe("withImageCaching", () => {
  it("keeps the Cache-Control OpenNext set, and leaves errors uncached", () => {
    const immutable = new Response("img", { headers: { "Cache-Control": "public, immutable" } })
    expect(withImageCaching("/_next/image", immutable).headers.get("cache-control")).toBe(
      "public, immutable",
    )
    const missing = new Response("bad", { status: 400 })
    expect(withImageCaching("/_next/image", missing).headers.get("cache-control")).toBeNull()
  })
})
