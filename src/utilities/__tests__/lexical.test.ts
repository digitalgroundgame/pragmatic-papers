import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext"
import { describe, expect, it } from "vitest"

import {
  createEmptyParagraph,
  createHeadingNode,
  createHorizontalRuleNode,
  createLinkNode,
  createListItemNode,
  createListNode,
  createParagraph,
  createQuoteNode,
  createRichText,
  createRichTextContent,
  createRichTextFromParagraphs,
  createRichTextFromString,
  createTableCellNode,
  createTableHeaderNode,
  createTableNode,
  createTableRowNode,
  createTextNode,
  type SerializedLexicalNode,
  TextFormat,
} from "@/utilities/lexical"

const childrenOf = (node: SerializedLexicalNode): SerializedLexicalNode[] =>
  (node as SerializedLexicalNode & { children: SerializedLexicalNode[] }).children

const typesOf = (nodes: SerializedLexicalNode[]): string[] => nodes.map((node) => node.type)

describe("lexical builders", () => {
  describe("createTextNode", () => {
    it("builds plain text by default", () => {
      expect(createTextNode("Hello")).toMatchObject({ type: "text", text: "Hello", format: 0 })
    })

    it("takes TextFormat flags, which combine bitwise", () => {
      expect(createTextNode("Hi", TextFormat.Bold | TextFormat.Italic).format).toBe(3)
    })
  })

  it("builds a custom link around a text node", () => {
    expect(createLinkNode("Docs", "https://example.com", true)).toMatchObject({
      type: "link",
      fields: { linkType: "custom", newTab: true, url: "https://example.com" },
      children: [{ type: "text", text: "Docs" }],
    })
    expect(createLinkNode("Docs", "/docs").fields.newTab).toBe(false)
  })

  describe("text-bearing blocks", () => {
    const bold = createTextNode("bold", TextFormat.Bold)

    it.each([
      ["createParagraph", createParagraph],
      ["createHeadingNode", createHeadingNode],
      ["createQuoteNode", createQuoteNode],
      ["createListItemNode", createListItemNode],
    ] as const)("%s accepts a string, a node or a list of nodes", (_, build) => {
      expect(childrenOf(build("plain"))).toEqual([createTextNode("plain")])
      expect(childrenOf(build(bold))).toEqual([bold])
      expect(childrenOf(build([bold, createTextNode(" text")]))).toEqual([
        bold,
        createTextNode(" text"),
      ])
    })

    it("applies element formatting to paragraphs", () => {
      expect(createParagraph("Centered", "center").format).toBe("center")
    })

    it("builds an h2 unless told otherwise", () => {
      expect(createHeadingNode("Title")).toMatchObject({ type: "heading", tag: "h2" })
      expect(createHeadingNode("Title", "h4")).toMatchObject({ tag: "h4" })
    })
  })

  describe("lists", () => {
    it("picks the element tag from the list type", () => {
      expect(createListNode([])).toMatchObject({ listType: "bullet", tag: "ul" })
      expect(createListNode([], "number")).toMatchObject({ listType: "number", tag: "ol" })
      expect(createListNode([], "check")).toMatchObject({ listType: "check", tag: "ul" })
    })

    it("sets checked only on check-list items", () => {
      expect(createListItemNode("Todo", 2)).toMatchObject({ value: 2 })
      expect(createListItemNode("Todo")).not.toHaveProperty("checked")
      expect(createListItemNode("Todo", 1, false)).toHaveProperty("checked", false)
    })
  })

  describe("tables", () => {
    it("marks header cells apart from body cells", () => {
      expect(createTableHeaderNode("Name")).toMatchObject({ type: "tablecell", headerState: 1 })
      expect(createTableCellNode("Ada")).toMatchObject({ type: "tablecell", headerState: 0 })
    })

    it("nests cells in rows in a table", () => {
      const table = createTableNode([createTableRowNode([createTableCellNode("Ada")])])

      expect(typesOf(childrenOf(table))).toEqual(["tablerow"])
      expect(typesOf(childrenOf(childrenOf(table)[0]!))).toEqual(["tablecell"])
    })
  })

  describe("rich text documents", () => {
    it("wraps nodes in a root", () => {
      expect(createRichText([createHorizontalRuleNode()]).root).toMatchObject({
        type: "root",
        children: [{ type: "horizontalrule" }],
      })
    })

    it("builds one paragraph from a string", () => {
      expect(createRichTextFromString("Hello").root.children).toEqual([createParagraph("Hello")])
      expect(createRichTextContent).toBe(createRichTextFromString)
    })

    it("puts an empty paragraph between paragraphs, not after the last, when spaced", () => {
      const spaced = createRichTextFromParagraphs(["One", "Two", "Three"], true).root.children

      expect(spaced).toEqual([
        createParagraph("One"),
        createEmptyParagraph(),
        createParagraph("Two"),
        createEmptyParagraph(),
        createParagraph("Three"),
      ])
    })

    it("does not space paragraphs by default", () => {
      expect(typesOf(createRichTextFromParagraphs(["One", "Two"]).root.children)).toEqual([
        "paragraph",
        "paragraph",
      ])
    })

    it("builds an empty document from no paragraphs", () => {
      expect(createRichTextFromParagraphs([], true).root.children).toEqual([])
    })

    it("builds documents Payload can read back", () => {
      const doc = createRichText([
        createHeadingNode("Title"),
        createParagraph([createTextNode("Hello "), createLinkNode("world", "/world")]),
        createListNode([createListItemNode("First"), createListItemNode("Second", 2)]),
        createQuoteNode("Quoted"),
      ])

      const text = convertLexicalToPlaintext({ data: doc })

      for (const fragment of ["Title", "Hello world", "First", "Second", "Quoted"]) {
        expect(text).toContain(fragment)
      }
    })
  })
})
