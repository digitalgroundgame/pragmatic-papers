import { afterEach, describe, expect, it, vi } from "vitest"

import {
  changeNoteOf,
  changedDocs,
  checkChangeNotes,
  main,
} from "../../scripts/check-doc-change-notes"

const doc = (summary: string, note?: string) =>
  `---\ntitle: Footnotes\nsummary: ${summary}\n${note === undefined ? "" : `changeNote: ${note}\n`}---\n\nBody.\n`

afterEach(() => vi.restoreAllMocks())

describe("changeNoteOf", () => {
  it("reads the note, plain or quoted", () => {
    expect(changeNoteOf(doc("A.", "Hide moved to the Ticker tab."))).toBe(
      "Hide moved to the Ticker tab.",
    )
    expect(changeNoteOf(doc("A.", '"Quoted: with a colon."'))).toBe("Quoted: with a colon.")
  })

  it("is null with no note, an empty one, or one in the body only", () => {
    expect(changeNoteOf(doc("A."))).toBeNull()
    expect(changeNoteOf(doc("A.", ""))).toBeNull()
    expect(changeNoteOf(`${doc("A.")}changeNote: not front matter\n`)).toBeNull()
  })
})

describe("checkChangeNotes", () => {
  const path = "src/docs/writing/footnotes.md"

  it("passes a changed doc with a new note, or a doc that didn't change", () => {
    expect(
      checkChangeNotes([{ path, before: doc("A."), after: doc("B.", "Says B now.") }]),
    ).toEqual([])
    expect(
      checkChangeNotes([{ path, before: doc("A.", "Old."), after: doc("B.", "New.") }]),
    ).toEqual([])
    expect(checkChangeNotes([{ path, before: doc("A."), after: doc("A.") }])).toEqual([])
  })

  it("refuses a changed doc with no note", () => {
    expect(checkChangeNotes([{ path, before: doc("A."), after: doc("B.") }])).toEqual([
      expect.stringMatching(/^src\/docs\/writing\/footnotes\.md: give it a changeNote/),
    ])
  })

  it("refuses the note from the doc's last change", () => {
    expect(
      checkChangeNotes([{ path, before: doc("A.", "Same."), after: doc("B.", "Same.") }]),
    ).toEqual([expect.stringContaining("the one from its last change")])
  })
})

/** A git that answers from `files` (`ref:path`) and lists `status` for the diff. */
const fakeGit = (status: string, files: Record<string, string>) =>
  vi.fn((args: string[]) => {
    if (args[0] === "diff") return status
    if (args[0] === "merge-base") return "abc123\n"
    if (args[0] === "show") return files[args[1]!] ?? ""
    throw new Error(`unexpected git ${args.join(" ")}`)
  })

describe("changedDocs", () => {
  it("lists modified and renamed docs with both copies, and only Markdown", () => {
    const git = fakeGit(
      "M\tsrc/docs/a.md\nR087\tsrc/docs/b.md\tsrc/docs/writing/b.md\nM\tsrc/docs/a-hero.webp\n",
      {
        "base:src/docs/a.md": "a before",
        "HEAD:src/docs/a.md": "a after",
        "base:src/docs/b.md": "b before",
        "HEAD:src/docs/writing/b.md": "b after",
      },
    )
    expect(changedDocs("base", git)).toEqual([
      { path: "src/docs/a.md", before: "a before", after: "a after" },
      { path: "src/docs/writing/b.md", before: "b before", after: "b after" },
    ])
    expect(git).toHaveBeenCalledWith([
      "diff",
      "--name-status",
      "-M",
      "--diff-filter=MR",
      "base",
      "HEAD",
      "--",
      "src/docs/",
    ])
  })
})

describe("main", () => {
  it("fails, naming each doc, when a changed doc has no new note", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const git = fakeGit("M\tsrc/docs/a.md\n", {
      "abc123:src/docs/a.md": doc("A."),
      "HEAD:src/docs/a.md": doc("B."),
    })
    expect(main([], git)).toBe(1)
    expect(git).toHaveBeenCalledWith(["merge-base", "origin/dev", "HEAD"])
    expect(error).toHaveBeenCalledWith(expect.stringContaining("src/docs/a.md"))
  })

  it("passes against the base it's given", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const git = fakeGit("M\tsrc/docs/a.md\n", {
      "HEAD^1:src/docs/a.md": doc("A."),
      "HEAD:src/docs/a.md": doc("B.", "Says B."),
    })
    expect(main(["--base", "HEAD^1"], git)).toBe(0)
    expect(git).not.toHaveBeenCalledWith(expect.arrayContaining(["merge-base"]))
  })
})
