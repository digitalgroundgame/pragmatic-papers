import { describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import {
  backedSince,
  barGroups,
  keepReplacedStatements,
  parseWhipCount,
  publicGroups,
  type WhipCountData,
  type WhipCountMember,
  type WhipCountStatement,
} from "../model"

const backer = (
  name: string,
  candidate: string,
  basisDate?: string,
  stance: "backs" | "leans" = "backs",
): WhipCountMember => ({
  name,
  state: "NY",
  party: "D",
  seat: "continuing",
  stance,
  candidate,
  ...(basisDate ? { basis: `${name} said so.`, basisDate } : {}),
  voting: true,
})

const said = (
  name: string,
  saidOn: string,
  stance?: WhipCountStatement["stance"],
  candidate?: string,
): WhipCountStatement => ({
  name,
  state: "NY",
  saidOn,
  statement: `${name} on ${saidOn}`,
  ...(stance ? { stance } : {}),
  ...(candidate ? { candidate } : {}),
})

const count = (members: WhipCountMember[], statements?: WhipCountStatement[]): WhipCountData => ({
  ...whipCountData,
  members,
  ...(statements ? { statements } : {}),
})

/** The names along the bar, left to right, for one stance on one candidate. */
const along = (data: WhipCountData, stance: string, candidate: string): string[] =>
  barGroups(publicGroups(data))
    .filter((g) => g.stance === stance && g.candidate?.id === candidate)
    .flatMap((g) => g.members.map((m) => m.name))

describe("backedSince", () => {
  it("is the latest statement's day when there is no history", () => {
    expect(backedSince(backer("A", "hale", "2026-11-10"), undefined)).toBe("2026-11-10")
  })

  it("is undefined when the latest statement isn't dated", () => {
    expect(backedSince(backer("A", "hale"), [said("A", "2026-11-01", "backs", "hale")])).toBe(
      undefined,
    )
  })

  it("reaches back through earlier statements backing the same candidate", () => {
    const history = [
      said("A", "2026-11-08", "backs", "hale"),
      said("A", "2026-11-04", "backs", "hale"),
      said("B", "2026-11-01", "backs", "hale"),
    ]
    expect(backedSince(backer("A", "hale", "2026-11-10"), history)).toBe("2026-11-04")
  })

  it("stops at a statement with another stance or candidate", () => {
    const history = [
      said("A", "2026-11-08", "backs", "hale"),
      said("A", "2026-11-06", "open"),
      said("A", "2026-11-02", "backs", "hale"),
    ]
    expect(backedSince(backer("A", "hale", "2026-11-10"), history)).toBe("2026-11-08")
    expect(
      backedSince(backer("A", "hale", "2026-11-10"), [said("A", "2026-11-03", "backs", "ortiz")]),
    ).toBe("2026-11-10")
    expect(
      backedSince(backer("A", "hale", "2026-11-10", "leans"), [
        said("A", "2026-11-03", "backs", "hale"),
      ]),
    ).toBe("2026-11-10")
  })

  it("skips statements whose stance isn't known", () => {
    const history = [said("A", "2026-11-08"), said("A", "2026-11-05", "backs", "hale")]
    expect(backedSince(backer("A", "hale", "2026-11-10"), history)).toBe("2026-11-05")
  })
})

describe("the bar's order by backing date", () => {
  const members = [
    backer("Late Left", "hale", "2026-11-12"),
    backer("Undated Left", "hale"),
    backer("Marion Hale", "hale", "2026-11-13"),
    backer("Early Left", "hale", "2026-11-02"),
    backer("Late Right", "ortiz", "2026-11-11"),
    backer("Daniel Ortiz", "ortiz", "2026-11-09"),
    backer("Undated Right", "ortiz"),
    backer("Early Right", "ortiz", "2026-11-03"),
  ]

  it("runs the first candidate's side from the candidate at the left edge inward", () => {
    expect(along(count(members), "backs", "hale")).toEqual([
      "Marion Hale",
      "Early Left",
      "Late Left",
      "Undated Left",
    ])
  })

  it("mirrors the second candidate's side, the candidate at the right edge", () => {
    expect(along(count(members), "backs", "ortiz")).toEqual([
      "Undated Right",
      "Late Right",
      "Early Right",
      "Daniel Ortiz",
    ])
  })

  it("orders by when the backing began, from the history", () => {
    const history = [said("Late Left", "2026-10-30", "backs", "hale")]
    expect(along(count(members, history), "backs", "hale")).toEqual([
      "Marion Hale",
      "Late Left",
      "Early Left",
      "Undated Left",
    ])
  })

  it("keeps the list order for members backing on the same day", () => {
    const same = [
      backer("Marion Hale", "hale", "2026-11-01"),
      backer("B", "hale", "2026-11-05"),
      backer("A", "hale", "2026-11-05"),
    ]
    expect(along(count(same), "backs", "hale")).toEqual(["Marion Hale", "B", "A"])
  })

  it("orders leaners the same way, between the backers and the middle", () => {
    const leaners = [
      backer("Marion Hale", "hale", "2026-11-01"),
      backer("Lean Late", "hale", "2026-11-09", "leans"),
      backer("Lean Early", "hale", "2026-11-04", "leans"),
    ]
    const names = barGroups(publicGroups(count(leaners))).flatMap((g) =>
      g.members.map((m) => m.name),
    )
    expect(names.slice(0, 3)).toEqual(["Marion Hale", "Lean Early", "Lean Late"])
  })

  it("lists each side's groups oldest backing first", () => {
    const backs = publicGroups(count(members)).find(
      (g) => g.stance === "backs" && g.candidate?.id === "ortiz",
    )
    expect(backs?.members.map((m) => m.name)).toEqual([
      "Daniel Ortiz",
      "Early Right",
      "Late Right",
      "Undated Right",
    ])
  })
})

describe("the stance a statement stood behind", () => {
  it("is kept when a newer statement replaces it, so the history can date a backing", () => {
    const before = count([
      backer("Marion Hale", "hale", "2026-11-01"),
      backer("A", "hale", "2026-11-03"),
    ])
    const after = count([
      backer("Marion Hale", "hale", "2026-11-01"),
      { ...backer("A", "hale", "2026-11-10"), source: { label: "x", url: "https://x.test/a" } },
    ])
    const kept = keepReplacedStatements(before.members, after, "editor")
    expect(kept.statements).toEqual([
      expect.objectContaining({ name: "A", stance: "backs", candidate: "hale" }),
    ])
    expect(backedSince(kept.members[1]!, kept.statements)).toBe("2026-11-03")
  })

  it("is read from pasted data, and refused when it isn't a stance", () => {
    const raw = JSON.parse(JSON.stringify(whipCountData)) as Record<string, unknown>
    const parsed = parseWhipCount({
      ...raw,
      statements: [{ ...said("A", "2026-11-01"), stance: "backs", candidate: "hale" }],
    })
    expect(parsed.success && parsed.value.statements?.[0]).toMatchObject({
      stance: "backs",
      candidate: "hale",
    })
    const wrong = parseWhipCount({
      ...raw,
      statements: [{ ...said("A", "2026-11-01"), stance: "maybe" }],
    })
    expect(wrong).toMatchObject({ success: false, error: expect.stringContaining('"stance"') })
  })
})
