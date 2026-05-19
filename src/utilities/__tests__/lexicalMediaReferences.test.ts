import { describe, expect, it } from "vitest"
import {
  findMediaReferencesInLexical,
  findMediaReferencesInLexicalContent,
} from "../lexicalMediaReferences"

describe("findMediaReferencesInLexical", () => {
  describe("mediaBlock", () => {
    it("finds a mediaBlock referencing the target media id", () => {
      const node = {
        type: "block",
        fields: { blockType: "mediaBlock", media: 42 },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([{ blockType: "mediaBlock", field: "media" }])
    })

    it("finds a mediaBlock with string media id matching number target", () => {
      const node = {
        type: "block",
        fields: { blockType: "mediaBlock", media: "42" },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([{ blockType: "mediaBlock", field: "media" }])
    })

    it("finds a mediaBlock with number media id matching string target", () => {
      const node = {
        type: "block",
        fields: { blockType: "mediaBlock", media: 42 },
      }

      const result = findMediaReferencesInLexical(node, "42")

      expect(result).toEqual([{ blockType: "mediaBlock", field: "media" }])
    })

    it("does not match a different media id", () => {
      const node = {
        type: "block",
        fields: { blockType: "mediaBlock", media: 99 },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([])
    })

    it("skips a block without fields", () => {
      const node = { type: "block" }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([])
    })
  })

  describe("mediaCollage", () => {
    it("finds a matching image in a mediaCollage", () => {
      const node = {
        type: "block",
        fields: {
          blockType: "mediaCollage",
          images: [{ media: 42 }, { media: 99 }],
        },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([{ blockType: "mediaCollage", field: "images" }])
    })

    it("finds multiple matching images in a single mediaCollage", () => {
      const node = {
        type: "block",
        fields: {
          blockType: "mediaCollage",
          images: [{ media: 42 }, { media: 42 }],
        },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([
        { blockType: "mediaCollage", field: "images" },
        { blockType: "mediaCollage", field: "images" },
      ])
    })

    it("skips mediaCollage when images is not an array", () => {
      const node = {
        type: "block",
        fields: { blockType: "mediaCollage", images: "not-array" },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([])
    })

    it("skips null entries in images array", () => {
      const node = {
        type: "block",
        fields: {
          blockType: "mediaCollage",
          images: [null, { media: 42 }],
        },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([{ blockType: "mediaCollage", field: "images" }])
    })
  })

  describe("nested children", () => {
    it("recurses into children", () => {
      const node = {
        type: "paragraph",
        children: [
          {
            type: "block",
            fields: { blockType: "mediaBlock", media: 42 },
          },
        ],
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([{ blockType: "mediaBlock", field: "media" }])
    })

    it("recurses multiple levels deep", () => {
      const node = {
        type: "root",
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "block",
                fields: { blockType: "mediaBlock", media: 42 },
              },
            ],
          },
        ],
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([{ blockType: "mediaBlock", field: "media" }])
    })

    it("collects references from multiple children", () => {
      const node = {
        type: "root",
        children: [
          {
            type: "block",
            fields: { blockType: "mediaBlock", media: 42 },
          },
          {
            type: "block",
            fields: { blockType: "mediaBlock", media: 42 },
          },
        ],
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([
        { blockType: "mediaBlock", field: "media" },
        { blockType: "mediaBlock", field: "media" },
      ])
    })
  })

  describe("unknown block types", () => {
    it("ignores blocks with an unrecognized blockType", () => {
      const node = {
        type: "block",
        fields: { blockType: "banner" },
      }

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([])
    })

    it("ignores nodes without a type", () => {
      const node = {}

      const result = findMediaReferencesInLexical(node, 42)

      expect(result).toEqual([])
    })
  })
})

describe("findMediaReferencesInLexicalContent", () => {
  it("returns references from valid Lexical content", () => {
    const content = {
      root: {
        children: [
          {
            type: "block",
            fields: { blockType: "mediaBlock", media: 42 },
          },
        ],
      },
    }

    const result = findMediaReferencesInLexicalContent(content, 42)

    expect(result).toEqual([{ blockType: "mediaBlock", field: "media" }])
  })

  it("returns empty array when content is null", () => {
    const result = findMediaReferencesInLexicalContent(null, 42)

    expect(result).toEqual([])
  })

  it("returns empty array when content is undefined", () => {
    const result = findMediaReferencesInLexicalContent(undefined, 42)

    expect(result).toEqual([])
  })

  it("returns empty array when content is a non-object", () => {
    const result = findMediaReferencesInLexicalContent("string", 42)

    expect(result).toEqual([])
  })

  it("returns empty array when root has no children", () => {
    const content = { root: {} }

    const result = findMediaReferencesInLexicalContent(content, 42)

    expect(result).toEqual([])
  })

  it("returns empty array when root is missing", () => {
    const content = { somethingElse: true }

    const result = findMediaReferencesInLexicalContent(content, 42)

    expect(result).toEqual([])
  })
})
