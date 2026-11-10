// @vitest-environment node
import type { Article } from "@/payload-types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setPublishedAtDefault } from "../setPublishedAtDefault"

const NOW = "2026-03-04T05:06:07.000Z"

const run = (siblingData: Partial<Article> | undefined, value?: Article["publishedAt"]) =>
  setPublishedAtDefault({ siblingData, value } as never)

describe("setPublishedAtDefault", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("dates an article published without a date as now", () => {
    expect(run({ _status: "published" })).toBe(NOW)
    expect(run({ _status: "published" }, null)).toBe(NOW)
  })

  it("keeps the date an editor picked", () => {
    const picked = "2025-01-02T03:04:05.000Z"

    expect(run({ _status: "published" }, picked)).toBe(picked)
    expect(run({ _status: "draft" }, picked)).toBe(picked)
  })

  it("leaves a draft undated", () => {
    expect(run({ _status: "draft" })).toBeUndefined()
    expect(run({ _status: "draft" }, null)).toBeNull()
    expect(run({})).toBeUndefined()
  })

  it("returns the value untouched when there's no sibling data", () => {
    expect(run(undefined)).toBeUndefined()
    expect(run(undefined, null)).toBeNull()
  })
})
