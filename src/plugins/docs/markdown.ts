import { createHash } from "node:crypto"

import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
  type SanitizedServerEditorConfig,
} from "@payloadcms/richtext-lexical"
import type { RichTextField, SanitizedConfig } from "payload"

import { DOCS_SLUG } from "./collection"
import { formatImageLine, parseImageLine } from "./docFile"
import { isMediaRef, type MediaRef } from "./repoDoc"

/** The docs collection's editor, whose features decide what the Markdown can hold. */
export function docsEditorConfig(config: SanitizedConfig): SanitizedServerEditorConfig {
  const collection = config.collections.find((item) => item.slug === DOCS_SLUG)
  const field = collection?.flattenedFields.find((item) => item.name === "content")
  if (field?.type !== "richText") throw new Error("The docs collection has no content field")
  return editorConfigFactory.fromField({ field: field as RichTextField })
}

interface LexicalNode {
  type: string
  [key: string]: unknown
}

interface LexicalRoot {
  root: LexicalNode & { children: LexicalNode[] }
}

/** The same id for the same picture in the same doc, so a sync writes the same content twice. */
const blockId = (slug: string, index: number): string =>
  createHash("sha256").update(`${slug}:${index}`).digest("hex").slice(0, 24)

const mediaBlock = (slug: string, index: number, ref: MediaRef): LexicalNode => ({
  type: "block",
  version: 2,
  format: "",
  fields: { id: blockId(slug, index), media: ref, blockName: "", blockType: "mediaBlock" },
})

/**
 * A doc's Markdown body as the docs editor's rich text. A picture on a line of its own becomes
 * a Media block holding a `MediaRef` to its file, which the sync uploads; the rest is Payload's
 * Markdown import, so it reads what the editor's features can hold.
 */
export function markdownToContent(
  slug: string,
  body: string,
  editorConfig: SanitizedServerEditorConfig,
): LexicalRoot {
  const children: LexicalNode[] = []
  let text: string[] = []
  let pictures = 0
  const flush = () => {
    const markdown = text.join("\n").trim()
    text = []
    if (!markdown) return
    const { root } = convertMarkdownToLexical({ editorConfig, markdown }) as unknown as LexicalRoot
    children.push(...root.children)
  }
  for (const line of body.split("\n")) {
    const image = parseImageLine(line)
    if (!image) {
      text.push(line)
      continue
    }
    flush()
    children.push(mediaBlock(slug, pictures++, { $media: image.file, alt: image.alt }))
  }
  flush()
  return {
    root: { type: "root", format: "", indent: 0, version: 1, direction: null, children },
  }
}

/** The picture a top-level node shows, when it's one Markdown can hold. */
const pictureIn = (node: LexicalNode): MediaRef | null => {
  if (node.type === "upload" && isMediaRef(node.value)) return node.value
  const fields = node.fields as { blockType?: string; media?: unknown } | undefined
  if (node.type === "block" && fields?.blockType === "mediaBlock" && isMediaRef(fields.media)) {
    return fields.media
  }
  return null
}

/**
 * The inverse, for an export: rich text whose media are `MediaRef`s as Markdown. Throws on a
 * block Markdown can't hold, naming it, rather than leaving it out of the file.
 */
export function contentToMarkdown(
  content: unknown,
  editorConfig: SanitizedServerEditorConfig,
): string {
  const root = (content as Partial<LexicalRoot> | null)?.root
  if (!root?.children?.length) return ""

  const parts: string[] = []
  let run: LexicalNode[] = []
  const flush = () => {
    if (!run.length) return
    const data = { root: { ...root, children: run } } as never
    parts.push(convertLexicalToMarkdown({ data, editorConfig }).trim())
    run = []
  }
  for (const node of root.children) {
    const picture = pictureIn(node)
    if (picture) {
      flush()
      parts.push(formatImageLine({ alt: picture.alt ?? "", file: picture.$media }))
    } else if (node.type === "block" || node.type === "upload") {
      const name = (node.fields as { blockType?: string } | undefined)?.blockType ?? node.type
      throw new Error(`A ${name} block can't be written as Markdown; take it out of the doc`)
    } else {
      run.push(node)
    }
  }
  flush()
  return parts.filter(Boolean).join("\n\n")
}
