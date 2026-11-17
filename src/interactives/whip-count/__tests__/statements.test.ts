import { describe, expect, it } from "vitest"

import { whipCountData, whipCountWithStatements } from "@/stories/fixtures/whipCount"

import {
  keepReplacedStatements,
  latestStatements,
  memberStatement,
  mergePushedCount,
  parseWhipCount,
  type WhipCountData,
  type WhipCountStatement,
} from "../model"

const raw = (data: WhipCountData): Record<string, unknown> =>
  JSON.parse(JSON.stringify(data)) as Record<string, unknown>

const okafor = (change: Partial<(typeof whipCountData.members)[number]>): WhipCountData => ({
  ...whipCountData,
  members: whipCountData.members.map((m) => (m.name === "Sam Okafor" ? { ...m, ...change } : m)),
})

describe("statements in the data", () => {
  it("are accepted as given, and absent when the count has none", () => {
    expect(parseWhipCount(raw(whipCountWithStatements))).toEqual({
      success: true,
      value: whipCountWithStatements,
    })
    const none = parseWhipCount({ ...raw(whipCountData), statements: [] })
    expect(none.success && none.value.statements).toBeUndefined()
  })

  it("label a source by its site when it has no label", () => {
    const parsed = parseWhipCount({
      ...raw(whipCountData),
      statements: [
        {
          name: "A",
          state: "NY",
          saidOn: "2026-11-14",
          statement: "Yes.",
          source: { url: "https://www.example.com/a" },
        },
      ],
    })
    expect(parsed.success && parsed.value.statements?.[0]?.source?.label).toBe("example.com")
  })

  it.each([
    ["a list that isn't", "many", '"statements" must be a list'],
    ["one with no words", [{ name: "A", state: "NY", saidOn: "2026-11-14" }], "needs a"],
    ["one with no date", [{ name: "A", state: "NY", statement: "Yes." }], '"saidOn" date'],
    [
      "one with an http link",
      [
        {
          name: "A",
          state: "NY",
          saidOn: "2026-11-14",
          statement: "Yes.",
          source: { url: "http://example.com" },
        },
      ],
      "https://",
    ],
  ])("refuse %s", (_name, statements, message) => {
    const parsed = parseWhipCount({ ...raw(whipCountData), statements })
    expect(!parsed.success && parsed.error).toContain(message)
  })
})

describe("latestStatements", () => {
  it("lists the members' latest and the earlier ones, newest first", () => {
    const list = latestStatements(whipCountWithStatements)
    expect(list.map((s) => `${s.saidOn} ${s.name}`)).toEqual([
      "2026-11-13 Daniel Ortiz",
      "2026-11-12 Marion Hale",
      "2026-11-11 Sam Okafor",
      "2026-11-07 Priya Raman",
      "2026-11-04 Luis Navarro",
      "2026-11-03 Luis Navarro",
      "2026-11-02 Priya Raman",
      "2026-11-01 Grace Lindqvist",
      "2026-10-30 Former Member",
    ])
  })

  it("leaves out undated statements, and lists one kept twice once", () => {
    const hale = memberStatement(whipCountData.members[0]!)!
    const list = latestStatements({ ...whipCountData, statements: [{ ...hale }] })
    expect(list.filter((s) => s.name === "Marion Hale")).toHaveLength(1)
    // Ana Whitfield and Grace Lindqvist have a basis with no date.
    expect(list.map((s) => s.name)).not.toContain("Ana Whitfield")
  })

  it("is empty for a count with no dated statement", () => {
    const undated = {
      ...whipCountData,
      members: whipCountData.members.map(({ basisDate: _d, ...m }) => m),
    }
    expect(latestStatements(undated)).toEqual([])
  })
})

describe("keepReplacedStatements", () => {
  const said: Partial<(typeof whipCountData.members)[number]> = {
    basis: "“I’ll back Hale.”",
    basisDate: "2026-11-10",
    source: { label: "example.com", url: "https://example.com/okafor-1" },
  }

  it("keeps a member's statement when a newer one replaces it", () => {
    const before = okafor(said)
    const after = okafor({
      basis: "“I’ve changed my mind.”",
      basisDate: "2026-11-14",
      source: { label: "example.com", url: "https://example.com/okafor-2" },
    })
    const kept = keepReplacedStatements(before.members, after, "editor")
    expect(kept.statements).toEqual<WhipCountStatement[]>([
      {
        name: "Sam Okafor",
        state: "VA",
        saidOn: "2026-11-10",
        statement: "“I’ll back Hale.”",
        source: { label: "example.com", url: "https://example.com/okafor-1" },
      },
    ])
    expect(latestStatements(kept).filter((s) => s.name === "Sam Okafor")).toHaveLength(2)
  })

  it("keeps nothing when a statement is only reworded under the same link", () => {
    const kept = keepReplacedStatements(
      okafor(said).members,
      okafor({ ...said, basis: "“I will back Hale.”" }),
      "editor",
    )
    expect(kept.statements).toBeUndefined()
  })

  it.each([
    ["a corrected date", { basisDate: "2026-11-11" }],
    [
      "a corrected link",
      { source: { label: "example.com", url: "https://example.com/okafor-fixed" } },
    ],
    ["a cleared statement", { basis: undefined, basisDate: undefined, source: undefined }],
  ])("keeps nothing for %s", (_name, change) => {
    const kept = keepReplacedStatements(
      okafor(said).members,
      okafor({ ...said, ...change }),
      "editor",
    )
    expect(kept.statements).toBeUndefined()
  })

  it.each([
    [
      "a second statement the same day",
      { source: { label: "example.com", url: "https://example.com/okafor-pm" } },
    ],
    ["a live page updated the next day", { basisDate: "2026-11-11" }],
  ])("keeps the earlier one when a push brings %s", (_name, change) => {
    const after = okafor({ ...said, basis: "“Later.”", ...change })
    const kept = keepReplacedStatements(okafor(said).members, after, "push")
    expect(kept.statements).toEqual([expect.objectContaining({ statement: "“I’ll back Hale.”" })])
    // An editor making the same change is taken to be correcting it.
    expect(keepReplacedStatements(okafor(said).members, after, "editor").statements).toBeUndefined()
  })

  it("keeps nothing when a push rewords a statement under the same link and day", () => {
    const after = okafor({ ...said, basis: "“I will back Hale.”" })
    expect(keepReplacedStatements(okafor(said).members, after, "push").statements).toBeUndefined()
  })

  it("keeps nothing for a member the count no longer has", () => {
    const before = okafor(said)
    const after = {
      ...whipCountData,
      members: whipCountData.members.filter((m) => m.name !== "Sam Okafor"),
    }
    expect(keepReplacedStatements(before.members, after, "editor").statements).toBeUndefined()
  })

  it("leaves out an earlier statement the editor removed", () => {
    const before = { ...whipCountWithStatements }
    const after = { ...whipCountWithStatements, statements: before.statements!.slice(1) }
    expect(keepReplacedStatements(before.members, after, "editor").statements).toEqual(
      before.statements!.slice(1),
    )
  })
})

describe("mergePushedCount with statements", () => {
  it("adds the push's statements to the document's and keeps the replaced one", () => {
    const current = { ...okafor({ basis: "“Not yet.”", basisDate: "2026-11-09" }) }
    const extra: WhipCountStatement = {
      name: "Marion Hale",
      state: "NY",
      saidOn: "2026-11-13",
      statement: "“We’re in good shape.”",
      source: { label: "example.com", url: "https://example.com/hale-2" },
    }
    const pushed = {
      ...okafor({ basis: "“I back Ortiz.”", basisDate: "2026-11-14" }),
      statements: [extra],
    }
    const merged = mergePushedCount(
      { ...current, statements: [...whipCountWithStatements.statements!] },
      pushed,
    )
    expect(merged.statements?.[0]).toEqual(extra)
    expect(merged.statements).toContainEqual(
      expect.objectContaining({
        name: "Sam Okafor",
        saidOn: "2026-11-09",
        statement: "“Not yet.”",
      }),
    )
    expect(merged.statements).toHaveLength(whipCountWithStatements.statements!.length + 2)
    // Pushing the same again changes nothing, so the push route answers "unchanged".
    expect(JSON.stringify(mergePushedCount(merged, pushed))).toBe(JSON.stringify(merged))
  })

  it("doesn't store a member's latest statement as history when the push resends it", () => {
    const pushed = { ...whipCountData, statements: [memberStatement(whipCountData.members[0]!)!] }
    expect(mergePushedCount(whipCountData, pushed).statements).toBeUndefined()
  })
})
