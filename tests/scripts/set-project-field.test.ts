import { afterEach, describe, expect, it, vi } from "vitest"

import {
  editFlags,
  main,
  parseBoard,
  setProjectField,
  type Field,
  type Gh,
} from "../../.claude/skills/github-issues/set-project-field"

const FIELDS: Field[] = [
  { id: "F_title", name: "Title", dataType: "TITLE", options: [] },
  { id: "F_labels", name: "Labels", dataType: "LABELS", options: [] },
  {
    id: "F_priority",
    name: "Priority",
    dataType: "SINGLE_SELECT",
    options: [
      { id: "O_p0", name: "P0" },
      { id: "O_p2", name: "P2" },
    ],
  },
  { id: "F_estimate", name: "Estimate", dataType: "NUMBER", options: [] },
  { id: "F_start", name: "Start date", dataType: "DATE", options: [] },
  { id: "F_notes", name: "Notes", dataType: "TEXT", options: [] },
]

function boardJson({
  items = [{ id: "I_on3", project: { number: 3 } }],
  project = true,
  issue = true,
}: {
  items?: { id: string; project: { number: number } }[]
  project?: boolean
  issue?: boolean
} = {}) {
  return JSON.stringify({
    data: {
      organization: {
        projectV2: project
          ? {
              id: "PVT_board",
              fields: {
                nodes: FIELDS.map(({ options, ...f }) =>
                  f.dataType === "SINGLE_SELECT" ? { ...f, options } : f,
                ),
              },
            }
          : null,
      },
      repository: {
        issue: issue
          ? {
              url: "https://github.com/digitalgroundgame/pragmatic-papers/issues/953",
              projectItems: { nodes: items },
            }
          : null,
      },
    },
  })
}

function fakeGh(board = boardJson()): { gh: Gh; calls: string[][] } {
  const calls: string[][] = []
  const gh: Gh = (args) => {
    calls.push(args)
    if (args[0] === "api") return board
    if (args[1] === "item-add") return JSON.stringify({ id: "I_new" })
    return ""
  }
  return { gh, calls }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("parseBoard", () => {
  it("picks the item on this project and defaults missing options to []", () => {
    const board = parseBoard(
      boardJson({
        items: [
          { id: "I_other", project: { number: 12 } },
          { id: "I_on3", project: { number: 3 } },
        ],
      }),
      953,
    )

    expect(board.projectId).toBe("PVT_board")
    expect(board.issueUrl).toBe("https://github.com/digitalgroundgame/pragmatic-papers/issues/953")
    expect(board.itemId).toBe("I_on3")
    expect(board.fields.find((f) => f.name === "Estimate")?.options).toEqual([])
  })

  it("reports no item when the issue isn't on this project", () => {
    expect(
      parseBoard(boardJson({ items: [{ id: "I_other", project: { number: 12 } }] }), 953).itemId,
    ).toBeNull()
  })

  it("throws when the project or the issue doesn't exist", () => {
    expect(() => parseBoard(boardJson({ project: false }), 953)).toThrow("Project 3 not found")
    expect(() => parseBoard(boardJson({ issue: false }), 953)).toThrow("Issue #953 not found")
  })
})

describe("editFlags", () => {
  it("maps a single-select value to its option ID", () => {
    expect(editFlags(FIELDS, "Priority", "P2")).toEqual([
      "--field-id",
      "F_priority",
      "--single-select-option-id",
      "O_p2",
    ])
  })

  it("passes numbers, dates and text through with the matching flag", () => {
    expect(editFlags(FIELDS, "Estimate", "0.5")).toEqual([
      "--field-id",
      "F_estimate",
      "--number",
      "0.5",
    ])
    expect(editFlags(FIELDS, "Start date", "2026-10-01")).toEqual([
      "--field-id",
      "F_start",
      "--date",
      "2026-10-01",
    ])
    expect(editFlags(FIELDS, "Notes", "hi")).toEqual(["--field-id", "F_notes", "--text", "hi"])
  })

  it("clears any field type", () => {
    expect(editFlags(FIELDS, "Priority", "--clear")).toEqual([
      "--field-id",
      "F_priority",
      "--clear",
    ])
    expect(editFlags(FIELDS, "Estimate", "--clear")).toEqual([
      "--field-id",
      "F_estimate",
      "--clear",
    ])
  })

  it("names the valid fields and options when one is misspelled", () => {
    expect(() => editFlags(FIELDS, "Priorty", "P2")).toThrow(
      'No field named "Priorty" on project 3. Fields: Title, Labels, Priority, Estimate, Start date, Notes',
    )
    expect(() => editFlags(FIELDS, "Priority", "P9")).toThrow(
      '"P9" isn\'t an option of Priority. Options: P0, P2',
    )
  })

  it.each([
    ["Estimate", "three", "Estimate takes a number"],
    ["Estimate", " ", "Estimate takes a number"],
    ["Start date", "10/01/2026", "Start date takes a YYYY-MM-DD date"],
  ])("rejects %s = %j", (name, value, message) => {
    expect(() => editFlags(FIELDS, name, value)).toThrow(message)
  })

  it("refuses fields the board only mirrors from the issue", () => {
    expect(() => editFlags(FIELDS, "Labels", "x")).toThrow("set it with `gh issue edit` instead")
  })
})

describe("setProjectField", () => {
  it("edits the existing board item", () => {
    const { gh, calls } = fakeGh()

    expect(setProjectField(953, "Priority", "P2", gh)).toBe("#953 Priority → P2")
    expect(calls[0]).toEqual(
      expect.arrayContaining(["api", "graphql", "-F", "project=3", "-F", "issue=953"]),
    )
    expect(calls.slice(1)).toEqual([
      [
        "project",
        "item-edit",
        "--project-id",
        "PVT_board",
        "--id",
        "I_on3",
        "--field-id",
        "F_priority",
        "--single-select-option-id",
        "O_p2",
      ],
    ])
  })

  it("adds the issue to the board first when it isn't on it", () => {
    const { gh, calls } = fakeGh(boardJson({ items: [] }))

    expect(setProjectField(953, "Estimate", "3", gh)).toBe(
      "#953 Estimate → 3 (added #953 to project 3)",
    )
    expect(calls[1]).toEqual([
      "project",
      "item-add",
      "3",
      "--owner",
      "digitalgroundgame",
      "--url",
      "https://github.com/digitalgroundgame/pragmatic-papers/issues/953",
      "--format",
      "json",
    ])
    expect(calls[2]).toEqual(expect.arrayContaining(["--id", "I_new", "--number", "3"]))
  })

  it("doesn't add the issue when the edit itself is invalid", () => {
    const { gh, calls } = fakeGh(boardJson({ items: [] }))

    expect(() => setProjectField(953, "Priority", "P9", gh)).toThrow("isn't an option")
    expect(calls).toHaveLength(1)
  })

  it("reports a clear", () => {
    expect(setProjectField(953, "Priority", "--clear", fakeGh().gh)).toBe("#953 Priority cleared")
  })
})

describe("main", () => {
  it.each([[[]], [["953", "Priority"]], [["abc", "Priority", "P2"]], [["0", "Priority", "P2"]]])(
    "prints usage and exits 2 for %j",
    (argv) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
      expect(main(argv, fakeGh().gh)).toBe(2)
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Usage:"))
    },
  )

  it("prints the result and exits 0", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    expect(main(["953", "Priority", "P0"], fakeGh().gh)).toBe(0)
    expect(warn).toHaveBeenCalledWith("#953 Priority → P0")
  })

  it("surfaces gh's own error text and exits 1", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const gh: Gh = () => {
      throw Object.assign(new Error("Command failed"), {
        stderr: "gh: Could not resolve to an Issue with the number of 999999.\n",
      })
    }

    expect(main(["999999", "Priority", "P2"], gh)).toBe(1)
    expect(error).toHaveBeenCalledWith(
      "gh: Could not resolve to an Issue with the number of 999999.",
    )
  })
})
