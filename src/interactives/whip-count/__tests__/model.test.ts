import { describe, expect, it } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

import {
  assignBloc,
  blocsOf,
  cleanDraft,
  majorityOf,
  parseWhipCount,
  publicGroups,
  startingDraft,
  tallyDraft,
  votingMembers,
  withOutgoing,
} from "../model"

const raw = (): Record<string, unknown> =>
  JSON.parse(JSON.stringify(whipCountData)) as Record<string, unknown>

describe("parseWhipCount", () => {
  it("accepts the fixture and returns it unchanged", () => {
    const parsed = parseWhipCount(raw())
    expect(parsed).toEqual({ success: true, value: whipCountData })
  })

  it("drops keys it does not know", () => {
    const input = raw()
    input.colour = "red"
    const parsed = parseWhipCount(input)
    expect(parsed.success && "colour" in parsed.value).toBe(false)
  })

  it.each([
    ["a list", [], "The data must be a JSON object."],
    ["another schema", { ...raw(), schema: "x" }, '"schema" must be'],
    ["a bad date", { ...raw(), asOf: "Nov 13" }, '"asOf" must be a date'],
    ["one candidate", { ...raw(), candidates: [{ id: "a", name: "A" }] }, "at least two"],
    ["no members", { ...raw(), members: [] }, '"members" must list'],
  ])("refuses %s", (_name, input, message) => {
    const parsed = parseWhipCount(input)
    expect(parsed.success).toBe(false)
    expect(!parsed.success && parsed.error).toContain(message)
  })

  const withMember = (change: Record<string, unknown>): unknown => {
    const input = raw()
    const members = input.members as Record<string, unknown>[]
    members[0] = { ...members[0], ...change }
    return input
  }

  it.each([
    ["a stance it does not know", { stance: "maybe" }, '"stance" must be one of'],
    ["a seat it does not know", { seat: "retired" }, '"seat" must be one of'],
    ["a candidate not in the list", { candidate: "nobody" }, 'needs a "candidate"'],
    ["a source that is not https", { source: { url: "javascript:alert(1)" } }, "https://"],
    ["a bad basis date", { basisDate: "yesterday" }, '"basisDate" must be a date'],
  ])("refuses a member with %s", (_name, change, message) => {
    const parsed = parseWhipCount(withMember(change))
    expect(!parsed.success && parsed.error).toContain(message)
    expect(!parsed.success && parsed.error).toContain("Marion Hale")
  })

  it("refuses the same member twice", () => {
    const input = raw()
    const members = input.members as unknown[]
    members.push(members[0])
    const parsed = parseWhipCount(input)
    expect(!parsed.success && parsed.error).toBe('"Marion Hale" is listed twice.')
  })

  it("labels a source by its host when it has no label", () => {
    const parsed = parseWhipCount(withMember({ source: { url: "https://www.example.org/a" } }))
    expect(parsed.success && parsed.value.members[0]?.source?.label).toBe("example.org")
  })

  it("leaves an outgoing member out of the vote unless the data counts them", () => {
    const input = raw()
    const members = input.members as Record<string, unknown>[]
    const finch = members.find((m) => m.name === "Walter Finch")!
    delete finch.voting
    const parsed = parseWhipCount(input)
    const member = parsed.success && parsed.value.members.find((m) => m.name === "Walter Finch")
    expect(member && member.voting).toBe(false)
  })
})

describe("the public count", () => {
  it("counts only voting members, and a majority of them", () => {
    expect(votingMembers(whipCountData)).toHaveLength(9)
    expect(majorityOf(9)).toBe(5)
    expect(majorityOf(10)).toBe(6)
  })

  it("orders groups from the first candidate's backers to the last's", () => {
    expect(publicGroups(whipCountData).map((g) => [g.label, g.members.length])).toEqual([
      ["Backs Hale", 3],
      ["Leaning Hale", 1],
      ["Undeclared", 1],
      ["Open to a change", 1],
      ["Won’t back Hale", 1],
      ["Backs Ortiz", 2],
    ])
  })

  it("counts outgoing members when asked", () => {
    const counted = withOutgoing(whipCountData, true)
    expect(votingMembers(counted)).toHaveLength(10)
    expect(votingMembers(withOutgoing(counted, false))).toHaveLength(9)
  })
})

describe("a reader's draft", () => {
  it("starts with public backers and nobody else", () => {
    expect(startingDraft(whipCountData)).toEqual({
      "Marion Hale": "hale",
      "Priya Raman": "hale",
      "Tom Becker": "hale",
      "Daniel Ortiz": "ortiz",
      "Ruth Abernathy": "ortiz",
    })
  })

  it("tallies votes and names a winner at a majority", () => {
    const start = tallyDraft(whipCountData, startingDraft(whipCountData))
    expect(start.votes.map((v) => v.count)).toEqual([3, 2])
    expect(start.unassigned).toBe(4)
    expect(start.winner).toBeNull()

    const won = tallyDraft(whipCountData, {
      ...startingDraft(whipCountData),
      "Sam Okafor": "hale",
      "Ana Whitfield": "hale",
    })
    expect(won.winner?.id).toBe("hale")
  })

  it("lists blocs by size", () => {
    expect(blocsOf(whipCountData)).toEqual(["Progressive", "Mainstream", "Moderate"])
  })

  it("assigns a bloc's uncommitted members and leaves public backers alone", () => {
    const draft = assignBloc(whipCountData, startingDraft(whipCountData), "Progressive", "hale")
    expect(draft["Ana Whitfield"]).toBe("hale")
    expect(draft["Luis Navarro"]).toBe("hale")
    expect(draft["Daniel Ortiz"]).toBe("ortiz")
    expect(assignBloc(whipCountData, draft, "Progressive", null)["Ana Whitfield"]).toBeUndefined()
  })

  it("drops saved picks the data no longer has", () => {
    expect(
      cleanDraft(
        { "Sam Okafor": "hale", "Gone Senator": "hale", "Ana Whitfield": "nobody", x: 3 },
        whipCountData,
      ),
    ).toEqual({ "Sam Okafor": "hale" })
    expect(cleanDraft("nonsense", whipCountData)).toEqual({})
  })
})
