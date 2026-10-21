// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  newestSnapshot,
  shouldEnhance,
  shouldRevalidate,
  SOCIAL_EMBED_SNAPSHOT_TTL_MS,
} from "../helpers/snapshotFreshness"

const NOW = new Date("2026-06-01T00:00:00Z")
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("shouldEnhance", () => {
  it("enhances only snapshots that fetched successfully", () => {
    expect(shouldEnhance({ status: "ok" })).toBe(true)
    expect(shouldEnhance({ status: "not_found" })).toBe(false)
    expect(shouldEnhance({})).toBe(false)
    expect(shouldEnhance(null)).toBe(false)
    expect(shouldEnhance(undefined)).toBe(false)
  })
})

describe("shouldRevalidate", () => {
  it("has a 30-day default TTL", () => {
    expect(SOCIAL_EMBED_SNAPSHOT_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it("leaves a fresh snapshot alone", () => {
    expect(shouldRevalidate({ status: "ok", fetchedAt: ago(1000) })).toBe(false)
    expect(shouldRevalidate({ status: "ok", fetchedAt: ago(SOCIAL_EMBED_SNAPSHOT_TTL_MS) })).toBe(
      false,
    )
  })

  it("revalidates a snapshot past its TTL", () => {
    expect(
      shouldRevalidate({ status: "ok", fetchedAt: ago(SOCIAL_EMBED_SNAPSHOT_TTL_MS + 1) }),
    ).toBe(true)
  })

  it("honours a custom TTL", () => {
    expect(shouldRevalidate({ status: "ok", fetchedAt: ago(5000) }, 1000)).toBe(true)
    expect(shouldRevalidate({ status: "ok", fetchedAt: ago(500) }, 1000)).toBe(false)
  })

  it("treats a missing or unparseable fetchedAt as expired", () => {
    expect(shouldRevalidate({ status: "ok" })).toBe(true)
    expect(shouldRevalidate({ status: "ok", fetchedAt: "not a date" })).toBe(true)
  })

  it("never revalidates a snapshot that didn't fetch successfully", () => {
    expect(
      shouldRevalidate({ status: "error", fetchedAt: ago(SOCIAL_EMBED_SNAPSHOT_TTL_MS * 2) }),
    ).toBe(false)
    expect(shouldRevalidate(null)).toBe(false)
  })
})

describe("newestSnapshot", () => {
  const saved = { status: "ok" as const, fetchedAt: ago(SOCIAL_EMBED_SNAPSHOT_TTL_MS * 2) }
  const refreshed = { status: "not_found" as const, fetchedAt: ago(1000) }

  it("picks the later fetch, whichever side it's on", () => {
    expect(newestSnapshot(saved, refreshed)).toBe(refreshed)
    expect(newestSnapshot(refreshed, saved)).toBe(refreshed)
  })

  it("keeps the first when both were fetched at the same time", () => {
    const twin = { ...saved, status: "error" as const }
    expect(newestSnapshot(saved, twin)).toBe(saved)
  })

  it("returns the one that exists", () => {
    expect(newestSnapshot(saved, null)).toBe(saved)
    expect(newestSnapshot(undefined, refreshed)).toBe(refreshed)
    expect(newestSnapshot(null, null)).toBeUndefined()
  })

  it("prefers a dated snapshot over an undated one", () => {
    expect(newestSnapshot({ status: "ok" }, saved)).toBe(saved)
    expect(newestSnapshot(saved, { status: "ok", fetchedAt: "not a date" })).toBe(saved)
  })
})
