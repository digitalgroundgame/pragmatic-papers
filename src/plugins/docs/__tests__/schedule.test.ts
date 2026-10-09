import { describe, expect, it } from "vitest"

import { announcements } from "../schedule"

const doc = (slug: string, publishedAt: string) => ({ slug, publishedAt })
const OPTIONS = { launch: "2026-10-18", perWeek: 3 }

const schedule = (docs: ReturnType<typeof doc>[], now: string) =>
  Object.fromEntries(
    announcements(docs, OPTIONS, Date.parse(now)).map((entry) => [
      entry.doc.slug,
      entry.announceAt.slice(0, 10),
    ]),
  )

describe("announcements", () => {
  it("announces docs from launch on at once, under their own date", () => {
    // Even a doc dated ahead, as one shipping with the next release is on staging.
    expect(schedule([doc("new", "2026-10-25")], "2026-10-09")).toEqual({ new: "2026-10-25" })
  })

  it("releases the backlog a few a week from launch, newest feature first", () => {
    const backlog = Array.from({ length: 7 }, (_, i) => doc(`d${i}`, `2026-0${i + 1}-01`))
    expect(schedule(backlog, "2026-11-30")).toEqual({
      d6: "2026-10-18",
      d5: "2026-10-18",
      d4: "2026-10-18",
      d3: "2026-10-25",
      d2: "2026-10-25",
      d1: "2026-10-25",
      d0: "2026-11-01",
    })
    expect(Object.keys(schedule(backlog, "2026-10-26"))).toEqual([
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
      "d6",
    ])
    expect(schedule(backlog, "2026-10-17")).toEqual({})
  })

  it("orders docs from the same day by slug, so the weeks don't shuffle between requests", () => {
    const same = ["c", "a", "d", "b"].map((slug) => doc(slug, "2026-01-01"))
    expect(schedule(same, "2026-10-19")).toEqual({
      a: "2026-10-18",
      b: "2026-10-18",
      c: "2026-10-18",
    })
  })
})
