// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Header } from "@/payload-types"

const { purgeEdgeCache, revalidatePath, revalidateTag } = vi.hoisted(() => ({
  purgeEdgeCache: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }))
vi.mock("@/hooks/purgeEdgeCache", () => ({ purgeEdgeCache }))

const { onlyTickerFeedChanged, revalidateHeader } = await import("../hooks/revalidateHeader")
const { TICKER_SETTINGS_TAG } = await import("@/components/Ticker/items")

const header = (ticker: Header["ticker"], rest: Partial<Header> = {}): Header =>
  ({
    id: 1,
    navItems: [{ id: "a", link: { type: "custom", label: "Articles", url: "/articles" } }],
    ticker,
    updatedAt: "2026-10-12T00:00:00Z",
    ...rest,
  }) as Header

const before = header({ enabled: true, upcomingHours: 24, hidden: [] })

const save = (doc: Header, previousDoc: Header | undefined = before) =>
  revalidateHeader({
    doc,
    previousDoc,
    req: { payload: { logger: { info: vi.fn() } }, context: {} },
  } as never)

beforeEach(() => {
  purgeEdgeCache.mockClear()
  revalidatePath.mockClear()
  revalidateTag.mockClear()
})

describe("onlyTickerFeedChanged", () => {
  it("is true for hiding a post or changing how far ahead streams show", () => {
    const hid = header(
      { enabled: true, upcomingHours: 24, hidden: [{ url: "https://x.com/P/status/9" }] },
      { updatedAt: "2026-10-13T00:00:00Z" },
    )
    expect(onlyTickerFeedChanged(hid, before)).toBe(true)
    expect(
      onlyTickerFeedChanged(header({ enabled: true, upcomingHours: 6, hidden: [] }), before),
    ).toBe(true)
  })

  it("is false for switching the ticker, or for any change pages render", () => {
    expect(
      onlyTickerFeedChanged(header({ enabled: false, upcomingHours: 24, hidden: [] }), before),
    ).toBe(false)
    expect(onlyTickerFeedChanged(header(before.ticker, { navItems: [] }), before)).toBe(false)
  })

  it("is false without the previous version", () => {
    expect(onlyTickerFeedChanged(before, undefined)).toBe(false)
  })
})

describe("revalidateHeader", () => {
  it("clears only the ticker's settings when an editor hides a post, leaving every page cached", () => {
    save(
      header({ enabled: true, upcomingHours: 24, hidden: [{ url: "https://x.com/P/status/9" }] }),
    )
    expect(revalidateTag).toHaveBeenCalledWith(TICKER_SETTINGS_TAG, { expire: 0 })
    expect(revalidateTag).not.toHaveBeenCalledWith("global_header", expect.anything())
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(purgeEdgeCache).not.toHaveBeenCalled()
  })

  it("clears every page when the nav or the ticker's switch changes", () => {
    save(header({ enabled: false, upcomingHours: 24, hidden: [] }))
    expect(revalidateTag).toHaveBeenCalledWith(TICKER_SETTINGS_TAG, { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith("global_header", "max")
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
    expect(purgeEdgeCache).toHaveBeenCalledWith(expect.anything(), "header saved")
  })
})
