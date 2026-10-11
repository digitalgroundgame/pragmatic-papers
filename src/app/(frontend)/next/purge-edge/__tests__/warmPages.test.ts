// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MAX_WARM_PAGES, WARM_PATHS, warmPages } from "../warmPages"

const SITE = "https://example.com"

function fakePayload(volume: unknown) {
  return {
    find: vi.fn(async () => ({ docs: volume ? [volume] : [] })),
    logger: { info: vi.fn(), warn: vi.fn() },
  }
}

const ok = vi.fn<typeof fetch>(async () => new Response("<html></html>"))

beforeEach(() => {
  vi.stubEnv("SERVER_URL", SITE)
  ok.mockClear()
})

const requested = (fetchImpl: typeof ok): string[] =>
  fetchImpl.mock.calls.map(([url]) => String(url))

describe("warmPages", () => {
  it("requests the section pages, then the newest volume and its published articles", async () => {
    const payload = fakePayload({
      slug: "12",
      articles: [{ slug: "first", _status: "published" }, { slug: "draft", _status: "draft" }, 7],
    })

    await warmPages(payload as never, { fetchImpl: ok })

    expect(requested(ok)).toEqual([
      ...WARM_PATHS.map((path) => `${SITE}${path}`),
      `${SITE}/volumes/12`,
      `${SITE}/articles/first`,
    ])
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "volumes", overrideAccess: false }),
    )
    expect(payload.logger.info).toHaveBeenCalledWith(
      `Warmed ${WARM_PATHS.length + 2} pages after the deploy`,
    )
  })

  it(`stops at ${MAX_WARM_PAGES} pages`, async () => {
    const articles = Array.from({ length: 100 }, (_, i) => ({
      slug: `a${i}`,
      _status: "published",
    }))

    await warmPages(fakePayload({ slug: "1", articles }) as never, { fetchImpl: ok })

    expect(ok).toHaveBeenCalledTimes(MAX_WARM_PAGES)
  })

  it("logs the pages that failed and never throws", async () => {
    const payload = fakePayload(null)
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith("/articles")) return new Response("", { status: 500 })
      if (String(url).endsWith("/topics")) throw new TypeError("fetch failed")
      return new Response("")
    })

    await expect(warmPages(payload as never, { fetchImpl })).resolves.toBeUndefined()

    expect(payload.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^Warmed 6 of 8 pages .*\/articles, .*\/topics$/),
    )
  })

  it("still warms the section pages when the volume lookup fails", async () => {
    const payload = fakePayload(null)
    payload.find.mockRejectedValueOnce(new Error("db down"))

    await warmPages(payload as never, { fetchImpl: ok })

    expect(ok).toHaveBeenCalledTimes(WARM_PATHS.length)
    expect(payload.logger.warn).toHaveBeenCalledWith(
      "Couldn't look up the newest volume to warm: db down",
    )
  })
})
