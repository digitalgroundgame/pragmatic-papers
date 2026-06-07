import { describe, expect, it } from "vitest"

import { buildDefaultResolvers } from "../defaults"
import type { SerializedLexicalNode } from "@payloadcms/richtext-lexical/lexical"

describe("buildDefaultResolvers", () => {
  describe("heading", () => {
    it("returns an entry with depth from tag", () => {
      const heading = {
        type: "heading",
        tag: "h3",
        children: [{ type: "text", text: "Topic" }],
      } as unknown as SerializedLexicalNode
      const anchors = new Map<SerializedLexicalNode, string>([[heading, "topic"]])
      const resolvers = buildDefaultResolvers(anchors)
      const entry = resolvers.heading!(heading)
      expect(entry).toMatchObject({ label: "Topic", anchor: "topic", depth: 2 })
    })

    it("returns null when heading has no text", () => {
      const heading = {
        type: "heading",
        tag: "h2",
        children: [],
      } as unknown as SerializedLexicalNode
      const anchors = new Map<SerializedLexicalNode, string>()
      const resolvers = buildDefaultResolvers(anchors)
      expect(resolvers.heading!(heading)).toBeNull()
    })

    it("returns null when no anchor is precomputed for the node", () => {
      const heading = {
        type: "heading",
        tag: "h2",
        children: [{ type: "text", text: "Orphan" }],
      } as unknown as SerializedLexicalNode
      const anchors = new Map<SerializedLexicalNode, string>()
      const resolvers = buildDefaultResolvers(anchors)
      expect(resolvers.heading!(heading)).toBeNull()
    })

    it("defaults depth to 1 for unknown tags", () => {
      const heading = {
        type: "heading",
        children: [{ type: "text", text: "No tag" }],
      } as unknown as SerializedLexicalNode
      const anchors = new Map<SerializedLexicalNode, string>([[heading, "no-tag"]])
      const resolvers = buildDefaultResolvers(anchors)
      const entry = resolvers.heading!(heading)
      expect(entry?.depth).toBe(1)
    })

    it("defaults depth to 1 for unrecognised tag values", () => {
      const heading = {
        type: "heading",
        tag: "h7",
        children: [{ type: "text", text: "Weird" }],
      } as unknown as SerializedLexicalNode
      const anchors = new Map<SerializedLexicalNode, string>([[heading, "weird"]])
      const resolvers = buildDefaultResolvers(anchors)
      const entry = resolvers.heading!(heading)
      expect(entry?.depth).toBe(1)
    })
  })

  describe("table", () => {
    it("always labels as 'Table' regardless of cell content", () => {
      const table = {
        type: "table",
        children: [
          {
            children: [
              { children: [{ type: "text", text: "Region" }] },
              { children: [{ type: "text", text: "Total" }] },
            ],
          },
        ],
      } as unknown as SerializedLexicalNode
      const resolvers = buildDefaultResolvers(new Map())
      const entry = resolvers.table!(table)
      expect(entry).toMatchObject({ label: "Table", depth: 1 })
      expect(entry?.icon).toBeDefined()
    })
  })
})
