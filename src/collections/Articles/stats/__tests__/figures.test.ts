import { describe, expect, it, vi } from "vitest"

import type { PageFigures } from "@/integrations/google/analytics"

import { createFiguresCache } from "../figures"

const figures = (views: number): PageFigures => ({
  allTime: { views, readers: 0, readersWhoFinished: 0 },
  last30Days: { views, readers: 0, readersWhoFinished: 0 },
  last7Days: { views, readers: 0, readersWhoFinished: 0 },
  referrers: [],
})

function setup() {
  let now = 1_000_000
  const cache = createFiguresCache({ ttlMs: 60 * 60_000, cooldownMs: 60_000, now: () => now })
  let views = 0
  const load = vi.fn(async () => figures(++views))
  return { cache, load, tick: (ms: number) => (now += ms) }
}

describe("createFiguresCache", () => {
  it("keeps an article's figures for the TTL, then asks again", async () => {
    const { cache, load, tick } = setup()

    expect((await cache.get("1", load)).figures.allTime.views).toBe(1)
    tick(59 * 60_000)
    expect((await cache.get("1", load)).figures.allTime.views).toBe(1)
    expect(load).toHaveBeenCalledTimes(1)

    tick(2 * 60_000)
    expect((await cache.get("1", load)).figures.allTime.views).toBe(2)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("keeps each article apart", async () => {
    const { cache, load } = setup()
    await cache.get("1", load)
    await cache.get("2", load)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("refreshes, but not within the cooldown of the last fetch", async () => {
    const { cache, load, tick } = setup()
    await cache.get("1", load)

    tick(30_000)
    const throttled = await cache.get("1", load, { refresh: true })
    expect(throttled).toMatchObject({ throttled: true })
    expect(throttled.figures.allTime.views).toBe(1)
    expect(load).toHaveBeenCalledTimes(1)

    tick(31_000)
    const refreshed = await cache.get("1", load, { refresh: true })
    expect(refreshed).toMatchObject({ throttled: false, fetchedAt: 1_061_000 })
    expect(refreshed.figures.allTime.views).toBe(2)
  })

  it("doesn't keep a failure, so the next open tries again", async () => {
    const { cache } = setup()
    const failing = vi.fn(async (): Promise<PageFigures> => {
      throw new Error("GA said no")
    })
    await expect(cache.get("1", failing)).rejects.toThrow("GA said no")
    await expect(cache.get("1", async () => figures(5))).resolves.toMatchObject({
      figures: { allTime: { views: 5 } },
    })
  })

  it("asks GA once when several opens arrive together", async () => {
    const { cache, load } = setup()
    await Promise.all([cache.get("1", load), cache.get("1", load), cache.get("1", load)])
    expect(load).toHaveBeenCalledTimes(1)
  })
})
