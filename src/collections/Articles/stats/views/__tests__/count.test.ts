import type { Payload } from "payload"
import { describe, expect, it, vi } from "vitest"

import { recordView, viewCounts } from "../count"

const payloadWith = (rows: unknown[]) => {
  const execute = vi.fn(async () => ({ rows }))
  return { payload: { db: { drizzle: { execute } } } as unknown as Payload, execute }
}

describe("recordView", () => {
  it("says it counted when the article took the view", async () => {
    const { payload, execute } = payloadWith([{ article_id: 7 }])
    expect(await recordView(payload, 7)).toBe(true)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it("says it didn't when no published article has the id", async () => {
    expect(await recordView(payloadWith([]).payload, 7)).toBe(false)
  })
})

describe("viewCounts", () => {
  it("reads the sums as numbers", async () => {
    const { payload } = payloadWith([
      { all_time: "63", last_30_days: 15, last_7_days: 3, counting_since: "2026-10-20" },
    ])
    expect(await viewCounts(payload, 7)).toEqual({
      allTime: 63,
      last30Days: 15,
      last7Days: 3,
      countingSince: "2026-10-20",
    })
  })

  it("gives zeros, and no start, before anything is counted", async () => {
    expect(await viewCounts(payloadWith([]).payload, 7)).toEqual({
      allTime: 0,
      last30Days: 0,
      last7Days: 0,
      countingSince: null,
    })
  })
})
