import { describe, expect, it } from "vitest"

import { defaultResolvers } from "../defaults"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"

function heading(fields: Record<string, unknown>): SerializedLexicalNode {
  return { type: "heading", ...fields } as unknown as SerializedLexicalNode
}

describe("defaultResolvers", () => {
  describe("heading", () => {
    it("returns an entry with its stored anchor and depth from tag", () => {
      const node = heading({
        tag: "h3",
        anchor: "topic",
        children: [{ type: "text", text: "Topic" }],
      })
      expect(defaultResolvers.heading!(node)).toMatchObject({
        label: "Topic",
        anchor: "topic",
        depth: 2,
      })
    })

    it("returns null when heading has no text", () => {
      expect(
        defaultResolvers.heading!(heading({ tag: "h2", anchor: "x", children: [] })),
      ).toBeNull()
    })

    it("returns null when the heading has no stored anchor", () => {
      const node = heading({ tag: "h2", children: [{ type: "text", text: "Orphan" }] })
      expect(defaultResolvers.heading!(node)).toBeNull()
    })

    it("defaults depth to 1 for unknown tags", () => {
      const node = heading({ anchor: "no-tag", children: [{ type: "text", text: "No tag" }] })
      expect(defaultResolvers.heading!(node)?.depth).toBe(1)
    })

    it("defaults depth to 1 for unrecognised tag values", () => {
      const node = heading({
        tag: "h7",
        anchor: "weird",
        children: [{ type: "text", text: "Weird" }],
      })
      expect(defaultResolvers.heading!(node)?.depth).toBe(1)
    })

    it("lists a heading by its table of contents label when it has one", () => {
      const node = heading({
        tag: "h2",
        anchor: "michigan-senate",
        children: [{ type: "text", text: "Michigan Senate – Smith vs Jones" }],
        $: { tocLabel: "  Michigan Senate " },
      })
      expect(defaultResolvers.heading!(node)?.label).toBe("Michigan Senate")
    })

    it("uses the heading's text when its label is blank", () => {
      const node = heading({
        tag: "h2",
        anchor: "turnout",
        children: [{ type: "text", text: "Turnout" }],
        $: { tocLabel: "   " },
      })
      expect(defaultResolvers.heading!(node)?.label).toBe("Turnout")
    })

    it("leaves out a heading with a label but no text", () => {
      const node = heading({ tag: "h2", anchor: "x", children: [], $: { tocLabel: "Label" } })
      expect(defaultResolvers.heading!(node)).toBeNull()
    })
  })

  describe("table", () => {
    it("always labels as 'Table' regardless of cell content", () => {
      const table = {
        type: "table",
        anchor: "table-1",
        children: [
          {
            children: [
              { children: [{ type: "text", text: "Region" }] },
              { children: [{ type: "text", text: "Total" }] },
            ],
          },
        ],
      } as unknown as SerializedLexicalNode
      const entry = defaultResolvers.table!(table)
      expect(entry).toMatchObject({ label: "Table", anchor: "table-1" })
      expect(entry?.icon).toBeDefined()
    })

    it("returns null when the table has no stored anchor", () => {
      const table = { type: "table", children: [] } as unknown as SerializedLexicalNode
      expect(defaultResolvers.table!(table)).toBeNull()
    })
  })
})
