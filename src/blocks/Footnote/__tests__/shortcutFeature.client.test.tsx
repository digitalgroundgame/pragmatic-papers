import { describe, expect, it, vi } from "vitest"

// The shortcut plugin is bound to the Lexical editor; these mocks stand in for the editor's
// node API so the pure pieces (source collection, trigger matching, the menu option) can be
// exercised without a live editor. The component render itself is covered by its story.
const tree = vi.hoisted(() => ({ root: null as unknown }))

vi.mock("@payloadcms/richtext-lexical/client", () => ({
  $createInlineBlockNode: vi.fn(),
  $isInlineBlockNode: (n: { __kind?: string } | null) => n?.__kind === "inline",
  createClientFeature: (factory: unknown) => factory,
}))
vi.mock("@payloadcms/richtext-lexical/lexical", () => ({
  $getRoot: () => tree.root,
  $isElementNode: (n: { __kind?: string } | null) => n?.__kind === "element",
  $isTextNode: (n: { __kind?: string } | null) => n?.__kind === "text",
  TextNode: class {},
}))
vi.mock("@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [{}],
}))
vi.mock("@payloadcms/richtext-lexical/lexical/react/LexicalTypeaheadMenuPlugin", () => ({
  LexicalTypeaheadMenuPlugin: () => null,
  MenuOption: class {
    key: string
    constructor(key: string) {
      this.key = key
    }
  },
}))

import { collectFootnoteSources, FootnoteMenuOption, triggerFn } from "../shortcutFeature.client"

interface Fields {
  blockType?: string
  id?: string
  note?: string
  sourceId?: string
  attributionEnabled?: boolean
  link?: unknown
}
const element = (children: unknown[]) => ({ __kind: "element", getChildren: () => children })
const inline = (fields: Fields) => ({ __kind: "inline", getFields: () => fields })
const footnote = (fields: Fields) => inline({ blockType: "footnote", ...fields })

describe("collectFootnoteSources", () => {
  it("collects footnote nodes that have an id and a note, in document order", () => {
    tree.root = element([
      footnote({ id: "a", note: "First" }),
      element([footnote({ id: "b", note: "Nested" })]),
      footnote({ id: "c", note: "Third" }),
    ])
    expect(collectFootnoteSources().map((s) => [s.id, s.note])).toEqual([
      ["a", "First"],
      ["b", "Nested"],
      ["c", "Third"],
    ])
  })

  it("skips nodes that already reference a source, lack a note, or aren't footnotes", () => {
    tree.root = element([
      footnote({ id: "ref", note: "Has source", sourceId: "x" }),
      footnote({ id: "empty" }),
      inline({ blockType: "other", id: "o", note: "Other block" }),
      footnote({ id: "keep", note: "Kept" }),
    ])
    expect(collectFootnoteSources().map((s) => s.id)).toEqual(["keep"])
  })

  it("dedupes repeated ids, keeping the first", () => {
    tree.root = element([
      footnote({ id: "dup", note: "one" }),
      footnote({ id: "dup", note: "two" }),
    ])
    const out = collectFootnoteSources()
    expect(out).toHaveLength(1)
    expect(out[0]!.note).toBe("one")
  })

  it("carries the footnote's attribution and link through", () => {
    tree.root = element([
      footnote({ id: "a", note: "n", attributionEnabled: true, link: { url: "/x" } }),
    ])
    expect(collectFootnoteSources()[0]).toMatchObject({
      attributionEnabled: true,
      link: { url: "/x" },
    })
  })
})

describe("triggerFn", () => {
  it("matches a bare trigger at the start of the text", () => {
    expect(triggerFn("[^", {} as never)).toMatchObject({ leadOffset: 0, matchingString: "" })
  })

  it("matches a trigger after whitespace and captures the typed query", () => {
    const r = triggerFn("see [^ab", {} as never)
    expect(r).toMatchObject({ leadOffset: 4, matchingString: "ab" })
  })

  it("matches a trigger right after an opening paren", () => {
    expect(triggerFn("([^q", {} as never)).toMatchObject({ matchingString: "q" })
  })

  it("does not trigger in the middle of a word", () => {
    expect(triggerFn("word[^x", {} as never)).toBeNull()
  })

  it("stops triggering once the bracket is closed", () => {
    expect(triggerFn("[^done]", {} as never)).toBeNull()
  })
})

describe("FootnoteMenuOption", () => {
  it("keys the option by the source id and keeps the source", () => {
    const source = { id: "src-1", note: "A note", attributionEnabled: false }
    const option = new FootnoteMenuOption(source)
    expect(option.key).toBe("src-1")
    expect(option.source).toBe(source)
  })
})
