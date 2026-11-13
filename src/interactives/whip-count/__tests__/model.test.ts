import { describe, expect, it } from "vitest"

import senateLeader2026 from "@/endpoints/seed/features/whip-count/senate-leader-2026.json"
import { whipCountData } from "@/stories/fixtures/whipCount"

import {
  assignGroup,
  cleanDraft,
  groupsOf,
  hasOutgoing,
  majorityOf,
  mergePushedCount,
  parseWhipCount,
  publicGroups,
  stanceLabel,
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

  it.each([
    [
      "a candidate with no name",
      { candidates: [{ id: "a" }, { id: "b", name: "B" }] },
      "Candidate 1 needs",
    ],
    [
      "two candidates with one id",
      {
        candidates: [
          { id: "a", name: "A" },
          { id: "a", name: "B" },
        ],
      },
      'Two candidates share the id "a".',
    ],
    ["a member with no name", { members: [{ state: "NY" }] }, 'Member 1 needs a "name".'],
    ["a member with no state", { members: [{ name: "X" }] }, 'X needs a "state".'],
    ["a member that is not an object", { members: ["X"] }, 'Member 1 needs a "name".'],
  ])("refuses %s", (_name, change, message) => {
    const parsed = parseWhipCount({ ...raw(), ...change })
    expect(!parsed.success && parsed.error).toContain(message)
  })

  it("names a source it can't read a host from", () => {
    const parsed = parseWhipCount(withMember({ source: { url: "https://" } }))
    expect(parsed.success && parsed.value.members[0]?.source?.label).toBe("Source")
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

  it("counts an outgoing member unless the data says not to", () => {
    const input = raw()
    const members = input.members as Record<string, unknown>[]
    const finch = members.find((m) => m.name === "Walter Finch")!
    delete finch.voting
    const parsed = parseWhipCount(input)
    const member = parsed.success && parsed.value.members.find((m) => m.name === "Walter Finch")
    expect(member && member.voting).toBe(true)
  })

  it("takes a vote time with its offset, and refuses one without", () => {
    const ok = parseWhipCount({ ...raw(), voteAt: "2026-12-01T09:30:00-05:00" })
    expect(ok.success && ok.value.voteAt).toBe("2026-12-01T09:30:00-05:00")
    const bad = parseWhipCount({ ...raw(), voteAt: "2026-12-01" })
    expect(!bad.success && bad.error).toContain('"voteAt" must be a time with its offset')
  })
})

describe("the seeded Senate count", () => {
  it("is data the page accepts, and carries no quotations", () => {
    const parsed = parseWhipCount(senateLeader2026)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    // Outgoing senators are counted unless a reader unticks them.
    expect(votingMembers(parsed.value)).toHaveLength(60)
    expect(votingMembers(withOutgoing(parsed.value, false))).toHaveLength(56)
    expect(parsed.value.voteAt).toBe("2026-12-01T00:00:00-05:00")
    expect(parsed.value.members.filter((m) => m.basis)).toEqual([])
  })
})

describe("stanceLabel", () => {
  it("names the candidate, or stands in for one it isn't given", () => {
    const [hale] = whipCountData.candidates
    expect(stanceLabel("backs", hale)).toBe("Backs Hale")
    expect(stanceLabel("leans")).toBe("Leaning a candidate")
    expect(stanceLabel("opposes")).toBe("Won’t back a candidate")
    expect(stanceLabel("backs")).toBe("Backs a candidate")
    expect(stanceLabel("open", hale)).toBe("Open to a change")
    expect(stanceLabel("undeclared")).toBe("Undeclared")
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

  it("puts those who ruled the last candidate out, or lean their way, on the right side", () => {
    const data = {
      ...whipCountData,
      members: whipCountData.members.map((m) =>
        m.name === "Sam Okafor"
          ? { ...m, stance: "opposes" as const, candidate: "ortiz" }
          : m.name === "Grace Lindqvist"
            ? { ...m, stance: "leans" as const, candidate: "ortiz" }
            : m,
      ),
    }
    expect(publicGroups(data).map((g) => g.label)).toEqual([
      "Backs Hale",
      "Leaning Hale",
      "Won’t back Ortiz",
      "Won’t back Hale",
      "Leaning Ortiz",
      "Backs Ortiz",
    ])
    expect(hasOutgoing(data)).toBe(true)
    expect(hasOutgoing({ ...data, members: data.members.slice(0, 3) })).toBe(false)
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

  it("lists blocs by size, then tags, then the incoming", () => {
    expect(groupsOf(whipCountData).map((g) => [g.kind, g.name, g.members.length])).toEqual([
      ["bloc", "Progressive", 4],
      ["bloc", "Mainstream", 3],
      ["bloc", "Moderate", 2],
      ["tag", "Anti-establishment", 2],
      ["tag", "Independent", 1],
      ["seat", "Incoming senators", 1],
    ])
    const counted = groupsOf(withOutgoing(whipCountData, true))
    expect(counted.at(-1)).toMatchObject({ kind: "seat", name: "Outgoing senators" })
  })

  it("assigns a group's uncommitted members and leaves public backers alone", () => {
    const progressives = groupsOf(whipCountData).find((g) => g.name === "Progressive")!
    const draft = assignGroup(startingDraft(whipCountData), progressives, "hale")
    expect(draft["Ana Whitfield"]).toBe("hale")
    expect(draft["Luis Navarro"]).toBe("hale")
    expect(draft["Daniel Ortiz"]).toBe("ortiz")
    expect(assignGroup(draft, progressives, null)["Ana Whitfield"]).toBeUndefined()
  })

  it("keeps a member's tags once each and drops what isn't text", () => {
    const input = raw()
    const members = input.members as Record<string, unknown>[]
    members[0]!.tags = ["Leadership", " Leadership ", "", 3]
    const parsed = parseWhipCount(input)
    expect(parsed.success && parsed.value.members[0]?.tags).toEqual(["Leadership"])
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

describe("mergePushedCount", () => {
  it("takes the pushed count whole when the document has none", () => {
    expect(mergePushedCount(null, whipCountData)).toBe(whipCountData)
  })

  it("takes positions from the push and keeps the editors' blocs, tags and added members", () => {
    const current = {
      ...whipCountData,
      members: [
        ...whipCountData.members.map((m) =>
          m.name === "Sam Okafor" ? { ...m, bloc: "Conservative", tags: ["Persuadable"] } : m,
        ),
        { ...whipCountData.members[0]!, name: "Added By Hand" },
      ],
    }
    const pushed = {
      ...whipCountData,
      asOf: "2026-11-20",
      members: whipCountData.members
        .filter((m) => m.name !== "Kaya Tulugaq")
        .map((m) =>
          m.name === "Sam Okafor" ? { ...m, stance: "leans" as const, candidate: "hale" } : m,
        ),
    }
    const merged = mergePushedCount(current, pushed)
    expect(merged.asOf).toBe("2026-11-20")
    expect(merged.members.find((m) => m.name === "Sam Okafor")).toMatchObject({
      stance: "leans",
      candidate: "hale",
      bloc: "Conservative",
      tags: ["Persuadable"],
    })
    // Members the push doesn't know stay, after the ones it does.
    expect(merged.members.slice(-2).map((m) => m.name)).toEqual(["Kaya Tulugaq", "Added By Hand"])
  })
})
