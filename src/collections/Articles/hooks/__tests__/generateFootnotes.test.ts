// @vitest-environment node
import type { Article, FootnoteBlock } from "@/payload-types"
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical"
import { describe, expect, it } from "vitest"

import { collectFootnotes, generateFootnotes } from "../generateFootnotes"

type Fields = Partial<FootnoteBlock> & { note?: string }

const footnote = (fields: Fields) => ({
  type: "inlineBlock",
  version: 1,
  fields: { blockType: "footnote", note: "", ...fields },
})

const text = (value: string) => ({ type: "text", version: 1, text: value })

const paragraph = (...children: unknown[]) => ({ type: "paragraph", version: 1, children })

const editor = (...children: unknown[]) =>
  ({
    root: { type: "root", version: 1, children },
  }) as unknown as SerializedEditorState

/** Every footnote's fields in document order, including the in-place edits the hook makes. */
const inlineFields = (state: SerializedEditorState): FootnoteBlock[] => {
  const out: FootnoteBlock[] = []
  const visit = (node: { type?: string; fields?: FootnoteBlock; children?: unknown[] }) => {
    if (node.type === "inlineBlock" && node.fields) out.push(node.fields)
    node.children?.forEach((child) => visit(child as typeof node))
  }
  state.root.children.forEach((child) => visit(child as never))
  return out
}

describe("collectFootnotes", () => {
  it("returns an empty list when there's no editor state or no root children", () => {
    expect(collectFootnotes(undefined)).toEqual([])
    expect(collectFootnotes({ root: {} } as unknown as SerializedEditorState)).toEqual([])
  })

  it("returns an empty list for content with no footnotes", () => {
    expect(collectFootnotes(editor(paragraph(text("No notes here."))))).toEqual([])
  })

  it("indexes a single footnote and gives it an id", () => {
    const state = editor(paragraph(text("Claim"), footnote({ note: "Source A" })))

    const result = collectFootnotes(state)

    expect(result).toHaveLength(1)
    expect(result?.[0]).toMatchObject({ note: "Source A", index: 1 })
    expect(result?.[0]?.id).toEqual(expect.any(String))
  })

  it("keeps an existing id", () => {
    const state = editor(paragraph(footnote({ id: "fn-1", note: "Source A" })))

    expect(collectFootnotes(state)?.[0]?.id).toBe("fn-1")
  })

  it("numbers multiple unique footnotes in document order, across nested nodes", () => {
    const state = editor(
      paragraph(footnote({ note: "First" })),
      {
        type: "list",
        version: 1,
        children: [{ type: "listitem", version: 1, children: [footnote({ note: "Second" })] }],
      },
      paragraph(footnote({ note: "Third" })),
    )

    const result = collectFootnotes(state)

    expect(result?.map(({ note, index }) => [note, index])).toEqual([
      ["First", 1],
      ["Second", 2],
      ["Third", 3],
    ])
  })

  it("collapses duplicate notes into one entry and reuses its index", () => {
    const state = editor(
      paragraph(footnote({ note: "Same" }), footnote({ note: "Other" })),
      paragraph(footnote({ note: "Same" })),
    )

    const result = collectFootnotes(state)

    expect(result?.map(({ note, index }) => [note, index])).toEqual([
      ["Same", 1],
      ["Other", 2],
    ])
    expect(inlineFields(state).map((f) => f.index)).toEqual([1, 2, 1])
  })

  it("treats the same note with different custom links as different footnotes", () => {
    const state = editor(
      paragraph(
        footnote({ note: "Same", attributionEnabled: true, link: { type: "custom", url: "/a" } }),
        footnote({ note: "Same", attributionEnabled: true, link: { type: "custom", url: "/b" } }),
        footnote({ note: "Same", attributionEnabled: true, link: { type: "custom", url: "/a" } }),
      ),
    )

    expect(inlineFields(state).length).toBe(3)
    expect(collectFootnotes(state)).toHaveLength(2)
    expect(inlineFields(state).map((f) => f.index)).toEqual([1, 2, 1])
  })

  it("dedupes reference links by the referenced document's id", () => {
    const ref = (id: number) =>
      footnote({
        note: "Ref",
        attributionEnabled: true,
        link: {
          type: "reference",
          reference: { relationTo: "articles", value: { id } as Article },
        },
      })
    const state = editor(paragraph(ref(7), ref(8), ref(7)))

    expect(collectFootnotes(state)).toHaveLength(2)
    expect(inlineFields(state).map((f) => f.index)).toEqual([1, 2, 1])
  })

  it("ignores the link when attribution is off", () => {
    const state = editor(
      paragraph(
        footnote({ note: "Same", attributionEnabled: false, link: { type: "custom", url: "/a" } }),
        footnote({ note: "Same" }),
      ),
    )

    expect(collectFootnotes(state)).toHaveLength(1)
  })

  it("copies a reference's note and link from its source and shares its index", () => {
    const link = { type: "custom" as const, url: "https://example.com" }
    const state = editor(
      paragraph(footnote({ id: "src", note: "Original", attributionEnabled: true, link })),
      paragraph(footnote({ note: "Other" })),
      paragraph(footnote({ sourceId: "src", note: "stale copy" })),
    )

    const result = collectFootnotes(state)
    const reference = inlineFields(state)[2]

    expect(result).toHaveLength(2)
    expect(reference).toMatchObject({ note: "Original", attributionEnabled: true, link, index: 1 })
  })

  it("promotes a reference whose source is gone to a footnote of its own", () => {
    const state = editor(paragraph(footnote({ sourceId: "missing", note: "Orphan" })))

    const result = collectFootnotes(state)

    expect(result).toHaveLength(1)
    expect(result?.[0]).toMatchObject({ note: "Orphan", sourceId: null, index: 1 })
  })

  it("skips inline blocks that aren't footnotes", () => {
    const state = editor(
      paragraph({ type: "inlineBlock", version: 1, fields: { blockType: "inlineMathBlock" } }),
    )

    expect(collectFootnotes(state)).toEqual([])
  })
})

describe("generateFootnotes", () => {
  it("writes the collected footnotes onto the data", () => {
    const data = { content: editor(paragraph(footnote({ note: "A" }))) } as Partial<Article>

    const result = generateFootnotes({ data } as never) as Partial<Article>

    expect(result.footnotes).toHaveLength(1)
  })

  it("leaves data without content untouched", () => {
    const data = { title: "No content" } as Partial<Article>

    const result = generateFootnotes({ data } as never) as Partial<Article>

    expect(result).toEqual({ title: "No content" })
  })
})
