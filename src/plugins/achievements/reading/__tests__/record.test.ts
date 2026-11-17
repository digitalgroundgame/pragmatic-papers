import { beforeEach, describe, expect, it } from "vitest"

import { READS_SLUG } from "../constants"
import type { ResolvedReadingConfig } from "../types"
import { recordRead, recordVisit } from "../record"
import { readingTotals } from "../totals"
import { fakePayload } from "./fakePayload"

const config: ResolvedReadingConfig = {
  usersSlug: "users",
  articlesSlug: "articles",
  groups: { slug: "volumes", field: "articles" },
  currentUser: async () => null,
  readers: () => false,
  disabled: false,
  enabled: async () => true,
}

const published = (id: number) => ({ id, _status: "published" })

let fake: ReturnType<typeof fakePayload>
beforeEach(() => {
  fake = fakePayload({
    users: [{ id: 1 }],
    articles: [published(10), published(11), published(12), { id: 13, _status: "draft" }],
    volumes: [
      { id: 1, _status: "published", articles: [10, 11] },
      { id: 2, _status: "published", articles: [10, 12] },
      { id: 3, _status: "published", articles: [] },
      { id: 4, _status: "draft", articles: [10] },
    ],
  })
})

const reader = () => fake.store.users![0]!

describe("recordVisit", () => {
  it("counts the first visit of a day, and only that one", async () => {
    expect(await recordVisit(fake.payload, reader(), "2026-11-08", config)).toBe(true)
    expect(await recordVisit(fake.payload, reader(), "2026-11-08", config)).toBe(false)
    expect(await recordVisit(fake.payload, reader(), "2026-11-09", config)).toBe(true)

    expect(fake.payload.db.updateOne).toHaveBeenCalledTimes(2)
    expect(reader().reading).toEqual({
      daysVisited: 2,
      lastVisitOn: "2026-11-09",
      currentStreak: 2,
      longestStreak: 2,
    })
  })

  it("writes past the users collection's hooks", async () => {
    await recordVisit(fake.payload, reader(), "2026-11-08", config)
    expect(fake.payload.db.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "users", id: 1, returning: false }),
    )
  })
})

describe("recordRead", () => {
  it("keeps one row per reader and article", async () => {
    expect(await recordRead(fake.payload, reader(), 10, config)).toBe(true)
    expect(await recordRead(fake.payload, reader(), 10, config)).toBe(false)
    expect(fake.store[READS_SLUG]).toEqual([
      expect.objectContaining({ user: 1, article: 10, readAt: expect.any(String) }),
    ])
  })

  it("ignores drafts and articles that don't exist", async () => {
    expect(await recordRead(fake.payload, reader(), 13, config)).toBe(false)
    expect(await recordRead(fake.payload, reader(), 99, config)).toBe(false)
    expect(fake.store[READS_SLUG]).toEqual([])
  })

  it("lets the unique index settle two reads at once", async () => {
    fake.payload.count.mockResolvedValueOnce({ totalDocs: 1 }).mockResolvedValueOnce({
      totalDocs: 0,
    })
    fake.store[READS_SLUG]!.push({ id: 1, user: 1, article: 10 })
    expect(await recordRead(fake.payload, reader(), 10, config)).toBe(false)
    expect(fake.store[READS_SLUG]).toHaveLength(1)
  })
})

describe("readingTotals", () => {
  const now = Date.parse("2026-11-09T18:00:00Z")

  it("counts articles, the published volumes finished, and the visits", async () => {
    await recordVisit(fake.payload, reader(), "2026-11-08", config)
    await recordVisit(fake.payload, reader(), "2026-11-09", config)
    for (const article of [10, 11]) await recordRead(fake.payload, reader(), article, config)

    expect(await readingTotals(fake.payload, reader(), config, now)).toEqual({
      articlesRead: 2,
      // Volume 1 only: 2 is missing an article, 3 is empty and 4 is a draft.
      volumesRead: 1,
      daysVisited: 2,
      currentStreak: 2,
      longestStreak: 2,
    })
  })

  it("has no volumes to count when the site has none", async () => {
    const withoutGroups = { ...config, groups: undefined }
    expect(await readingTotals(fake.payload, reader(), withoutGroups, now)).toMatchObject({
      articlesRead: 0,
      volumesRead: null,
      currentStreak: 0,
    })
  })
})
