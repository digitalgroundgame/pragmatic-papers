import type { FootnotesField } from "@/payload-types"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const documentInfo = vi.hoisted(() => ({
  value: {} as { data?: { footnotes?: FootnotesField } },
}))

// The real hook needs the admin form context; we only ever read `data.footnotes` off it.
vi.mock("@payloadcms/ui", () => ({
  useDocumentInfo: () => documentInfo.value,
}))

import {
  FootnoteLabelClient,
  resolveIndexByNote,
  resolveIndexBySourceId,
} from "../FootnoteLabelClient"

const footnote = (
  overrides: Partial<NonNullable<FootnotesField>[number]> = {},
): NonNullable<FootnotesField>[number] => ({
  note: "A source note",
  attributionEnabled: false,
  ...overrides,
})

beforeEach(() => {
  documentInfo.value = { data: { footnotes: [] } }
})

afterEach(cleanup)

describe("resolveIndexBySourceId", () => {
  it("returns the index of the footnote whose id matches sourceId", () => {
    const footnotes = [footnote({ id: "a", index: 1 }), footnote({ id: "b", index: 9 })]

    expect(resolveIndexBySourceId(footnotes, "b")).toBe(9)
  })

  it("returns null when no footnote's id matches sourceId", () => {
    const footnotes = [footnote({ id: "a", index: 1 })]

    expect(resolveIndexBySourceId(footnotes, "missing")).toBeNull()
  })

  it("returns null when sourceId is null or undefined", () => {
    const footnotes = [footnote({ id: "a", index: 1 })]

    expect(resolveIndexBySourceId(footnotes, null)).toBeNull()
    expect(resolveIndexBySourceId(footnotes, undefined)).toBeNull()
  })

  it("returns null when the matched footnote's index is null", () => {
    const footnotes = [footnote({ id: "a", index: null })]

    expect(resolveIndexBySourceId(footnotes, "a")).toBeNull()
  })
})

describe("resolveIndexByNote", () => {
  it("returns the index of the footnote whose note text matches", () => {
    const footnotes = [footnote({ note: "Ibid.", index: 3 })]

    expect(resolveIndexByNote(footnotes, "Ibid.")).toBe(3)
  })

  it("returns null when no footnote's note text matches", () => {
    const footnotes = [footnote({ note: "Ibid.", index: 3 })]

    expect(resolveIndexByNote(footnotes, "Something else")).toBeNull()
  })

  it("returns null when note is empty, null, or undefined", () => {
    const footnotes = [footnote({ note: "Ibid.", index: 3 })]

    expect(resolveIndexByNote(footnotes, "")).toBeNull()
    expect(resolveIndexByNote(footnotes, null)).toBeNull()
    expect(resolveIndexByNote(footnotes, undefined)).toBeNull()
  })

  it("returns the first match's index when duplicate note text exists", () => {
    // Mirrors generateFootnotes' dedup-by-document-order contract: the first
    // occurrence is the original, later duplicates share its index.
    const footnotes = [
      footnote({ id: "a", note: "Duplicate text", index: 1 }),
      footnote({ id: "b", note: "Duplicate text", index: 9 }),
    ]

    expect(resolveIndexByNote(footnotes, "Duplicate text")).toBe(1)
  })

  it("returns null when the matched footnote's index is null", () => {
    const footnotes = [footnote({ note: "Pending note", index: null })]

    expect(resolveIndexByNote(footnotes, "Pending note")).toBeNull()
  })
})

describe("FootnoteLabelClient", () => {
  it("shows a placeholder when there's no note yet", () => {
    render(<FootnoteLabelClient siblingData={{ note: "" } as never} />)

    expect(screen.getByText("Footnote")).toBeInTheDocument()
  })

  it("shows a placeholder when siblingData is missing entirely", () => {
    render(<FootnoteLabelClient />)

    expect(screen.getByText("Footnote")).toBeInTheDocument()
  })

  it("resolves the index from the document's footnotes array by matching note text", () => {
    documentInfo.value = {
      data: { footnotes: [footnote({ id: "a", note: "Ibid.", index: 3 })] },
    }

    render(<FootnoteLabelClient siblingData={{ note: "Ibid." } as never} />)

    expect(screen.getByText("[3]")).toBeInTheDocument()
  })

  it("falls back to the block's own index when no document footnote matches the note", () => {
    documentInfo.value = { data: { footnotes: [] } }

    render(<FootnoteLabelClient siblingData={{ note: "Brand new note", index: 5 } as never} />)

    expect(screen.getByText("[5]")).toBeInTheDocument()
  })

  it("falls back to the block's own index when the matched footnote's index is null", () => {
    // Regression pin: the nested `?? null` chain must still fall through past a
    // matched-but-indexless entry to the block's own `index`, not stop at null.
    documentInfo.value = {
      data: { footnotes: [footnote({ id: "a", note: "Pending note", index: null })] },
    }

    render(<FootnoteLabelClient siblingData={{ note: "Pending note", index: 7 } as never} />)

    expect(screen.getByText("[7]")).toBeInTheDocument()
  })

  it("shows the truncated note text when no index can be resolved at all", () => {
    documentInfo.value = { data: { footnotes: [] } }

    render(
      <FootnoteLabelClient
        siblingData={{ note: "This note is definitely longer than the preview limit" } as never}
      />,
    )

    expect(screen.getByText("This note is definit…")).toBeInTheDocument()
  })

  it("does not truncate a note that already fits within the preview limit", () => {
    documentInfo.value = { data: { footnotes: [] } }

    render(<FootnoteLabelClient siblingData={{ note: "Short note" } as never} />)

    expect(screen.getByText("Short note")).toBeInTheDocument()
  })

  it("prefixes a linked-footnote's index with an arrow when sourceId is set", () => {
    documentInfo.value = {
      data: { footnotes: [footnote({ id: "a", note: "Original note", index: 2 })] },
    }

    render(<FootnoteLabelClient siblingData={{ note: "Original note", sourceId: "a" } as never} />)

    expect(screen.getByText("↗ [2]")).toBeInTheDocument()
  })

  it("does not prefix an arrow for an original (non-linked) footnote", () => {
    documentInfo.value = {
      data: { footnotes: [footnote({ id: "a", note: "Original note", index: 2 })] },
    }

    render(<FootnoteLabelClient siblingData={{ note: "Original note" } as never} />)

    expect(screen.getByText("[2]")).toBeInTheDocument()
  })

  it("matches the first footnote by note text when duplicate note text exists", () => {
    // generateFootnotes dedupes data.footnotes by note text (first occurrence in
    // document order wins), so two entries sharing note text shouldn't reach the
    // client post-save — this pins the defensive "first match" fallback anyway.
    documentInfo.value = {
      data: {
        footnotes: [
          footnote({ id: "a", note: "Duplicate text", index: 1 }),
          footnote({ id: "b", note: "Duplicate text", index: 9 }),
        ],
      },
    }

    render(<FootnoteLabelClient siblingData={{ note: "Duplicate text" } as never} />)

    expect(screen.getByText("[1]")).toBeInTheDocument()
    expect(screen.queryByText("[9]")).not.toBeInTheDocument()
  })

  it("prefers a sourceId match over note text when both could resolve", () => {
    // sourceId always points at an already-persisted footnote, so it's the more
    // direct signal — this should win even if note text also happens to match a
    // different (stale) entry.
    documentInfo.value = {
      data: {
        footnotes: [
          footnote({ id: "a", note: "Shared text", index: 1 }),
          footnote({ id: "b", note: "Shared text", index: 9 }),
        ],
      },
    }

    render(<FootnoteLabelClient siblingData={{ note: "Shared text", sourceId: "b" } as never} />)

    expect(screen.getByText("↗ [9]")).toBeInTheDocument()
  })

  it("falls back to note-text matching when sourceId doesn't match anything", () => {
    // A sourceId can go stale (its target footnote was removed) — note text,
    // which InsertExistingFootnote keeps in sync with the source, still resolves it.
    documentInfo.value = {
      data: { footnotes: [footnote({ id: "a", note: "Orphaned link's note", index: 4 })] },
    }

    render(
      <FootnoteLabelClient
        siblingData={{ note: "Orphaned link's note", sourceId: "missing" } as never}
      />,
    )

    expect(screen.getByText("↗ [4]")).toBeInTheDocument()
  })

  it("falls back to the block's own index when neither sourceId nor note text matches", () => {
    documentInfo.value = { data: { footnotes: [] } }

    render(
      <FootnoteLabelClient
        siblingData={{ note: "Fully orphaned", sourceId: "missing", index: 6 } as never}
      />,
    )

    expect(screen.getByText("↗ [6]")).toBeInTheDocument()
  })

  it("treats a missing document footnotes array as empty rather than crashing", () => {
    documentInfo.value = { data: {} }

    render(<FootnoteLabelClient siblingData={{ note: "Untracked note", index: 4 } as never} />)

    expect(screen.getByText("[4]")).toBeInTheDocument()
  })
})
