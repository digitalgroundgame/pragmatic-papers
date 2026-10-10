// @vitest-environment node
import { readFileSync } from "node:fs"

import configPromise from "@payload-config"
import { format as prettier } from "prettier"
import { describe, expect, it } from "vitest"

import { formatDocFile, parseDocFile } from "../docFile"
import { contentToMarkdown, docsEditorConfig, markdownToContent } from "../markdown"
import { listDocFiles } from "../syncDocs"

const editorConfig = docsEditorConfig(await configPromise)
const docs = await listDocFiles()

const paragraph = (text: string, format = 0) => ({
  type: "paragraph",
  children: [{ type: "text", text, format }],
})

describe("markdownToContent", () => {
  it("turns a picture on its own line into a Media block that names its file", () => {
    const { root } = markdownToContent(
      "photos",
      "Before.\n\n![A drawer](photos-a.png)\n\nAfter.",
      editorConfig,
    )
    expect(root.children.map((node) => node.type)).toEqual(["paragraph", "block", "paragraph"])
    expect(root.children[1]).toMatchObject({
      type: "block",
      fields: { blockType: "mediaBlock", media: { $media: "photos-a.png", alt: "A drawer" } },
    })
  })

  it("gives the same picture the same block id every time", () => {
    const once = markdownToContent("photos", "![A](photos-a.png)", editorConfig)
    expect(markdownToContent("photos", "![A](photos-a.png)", editorConfig)).toEqual(once)
  })

  it("reads inline code", () => {
    const { root } = markdownToContent("photos", "Type `/banner`.", editorConfig)
    expect(root.children[0]).toMatchObject({
      children: [{ text: "Type " }, { text: "/banner", format: 16 }, { text: "." }],
    })
  })
})

describe("contentToMarkdown", () => {
  it("writes Media blocks as pictures", () => {
    const content = {
      root: {
        type: "root",
        children: [
          paragraph("Hello"),
          {
            type: "block",
            fields: { blockType: "mediaBlock", media: { $media: "photos-a.png", alt: "A" } },
          },
          paragraph("Bold", 1),
        ],
      },
    }
    expect(contentToMarkdown(content, editorConfig)).toBe("Hello\n\n![A](photos-a.png)\n\n**Bold**")
  })

  it("refuses a block Markdown can't hold", () => {
    const content = {
      root: { type: "root", children: [{ type: "block", fields: { blockType: "banner" } }] },
    }
    expect(() => contentToMarkdown(content, editorConfig)).toThrow(/banner block/)
  })
})

// What the export writes (formatted by Prettier, as the commit hook would) is what the sync
// reads, so a doc that comes back different here would change the next time it's exported.
describe.each(docs.map((doc) => [`${doc.section}/${doc.slug}.md`, doc] as const))(
  "src/docs/%s",
  (name, { slug, file }) => {
    it("comes back the same through the editor", async () => {
      const source = readFileSync(file, "utf8")
      const { meta, body } = parseDocFile(source, name)
      const content = markdownToContent(slug, body, editorConfig)
      const again = formatDocFile({ meta, body: contentToMarkdown(content, editorConfig) })
      expect(await prettier(again, { parser: "markdown" })).toBe(source)
    })
  },
)
