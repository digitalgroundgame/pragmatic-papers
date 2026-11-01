import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"

import { describeBlockAs } from "@/blocks/narration"
import { blockDescriptor } from "@/blocks/registry"
import type { NarrationContext } from "@/blocks/types"
import { formatLongDate } from "@/utilities/formatDate"
import { isRecord } from "@/utilities/isRecord"

export type MediaMap = Record<
  string | number,
  { alt?: string | null; caption?: unknown; filename?: string | null }
>

export interface ExtractNarrationTextOptions {
  title?: string | null
  authors?: Array<{ name?: string | null } | string | number> | null
  publishedAt?: string | Date | null
  content?: SerializedEditorState | Record<string, unknown> | null
  mediaMap?: MediaMap | null
}

function formatBlockContent(text: string): string {
  const trimmed = text.trim()
  return trimmed ? `${trimmed}\n\n` : ""
}

function resolveMediaInfo(
  mediaVal: unknown,
  mediaMap?: MediaMap | null,
): {
  alt?: string | null
  caption?: unknown
  filename?: string | null
  id?: string | number | null
} | null {
  if (!mediaVal) return null

  let mediaId: string | number | null = null
  let mediaObj: Record<string, unknown> | null = null

  if (typeof mediaVal === "number" || typeof mediaVal === "string") {
    mediaId = mediaVal
  } else if (isRecord(mediaVal)) {
    const obj = mediaVal
    if (typeof obj.alt === "string" || obj.caption || typeof obj.filename === "string") {
      mediaObj = obj
    } else if (
      "value" in obj &&
      typeof obj.value === "object" &&
      obj.value !== null &&
      !Array.isArray(obj.value)
    ) {
      mediaObj = obj.value as Record<string, unknown>
    } else if ("value" in obj && (typeof obj.value === "number" || typeof obj.value === "string")) {
      mediaId = obj.value as string | number
    } else if ("id" in obj && (typeof obj.id === "number" || typeof obj.id === "string")) {
      mediaId = obj.id as string | number
    }
  }

  if (mediaObj) {
    return {
      alt: typeof mediaObj.alt === "string" ? mediaObj.alt : null,
      caption: mediaObj.caption,
      filename: typeof mediaObj.filename === "string" ? mediaObj.filename : null,
      id: typeof mediaObj.id === "number" || typeof mediaObj.id === "string" ? mediaObj.id : null,
    }
  }

  if (mediaId !== null && mediaMap) {
    const mapped = mediaMap[mediaId]
    if (mapped) {
      return {
        alt: mapped.alt,
        caption: mapped.caption,
        filename: mapped.filename,
        id: mediaId,
      }
    }
  }

  return mediaId !== null ? { id: mediaId } : null
}

/**
 * What a block's `narrate` can ask of the article: a media value's caption
 * (preferred) or alt text, and nested rich text's plain text. Filenames and
 * ids are left out: they read terribly aloud and add nothing.
 */
function narrationContext(
  mediaMap: MediaMap | null | undefined,
  extractText: (node: SerializedLexicalNode, mediaMap?: MediaMap | null) => string,
): NarrationContext {
  return {
    describeMedia: (media) => {
      const mediaInfo = resolveMediaInfo(media, mediaMap)
      if (!mediaInfo) return ""

      if (mediaInfo.caption && typeof mediaInfo.caption === "object") {
        const caption = extractText(mediaInfo.caption as SerializedLexicalNode, mediaMap).trim()
        if (caption) return caption
      }

      return typeof mediaInfo.alt === "string" ? mediaInfo.alt.trim() : ""
    },
    textOf: (richText) =>
      richText && typeof richText === "object"
        ? extractText(richText as SerializedLexicalNode, mediaMap)
        : "",
  }
}

/**
  Recursively extract plain text from a Lexical node structure or editor state.
 */
function extractLexicalNodeText(
  node: SerializedLexicalNode | Record<string, unknown>,
  mediaMap?: MediaMap | null,
): string {
  if (!node || typeof node !== "object") return ""

  const nodeObj = node as Record<string, unknown>

  if (nodeObj.root && typeof nodeObj.root === "object") {
    return extractLexicalNodeText(nodeObj.root as SerializedLexicalNode, mediaMap)
  }

  const type = nodeObj.type as string | undefined

  // Omit visual rules
  if (type === "horizontalrule" || type === "squiggleRule") {
    return ""
  }

  // Handle soft linebreaks
  if (type === "linebreak") {
    return "\n"
  }

  // Blocks and inline blocks narrate as their descriptor's `narrate` says
  // (`src/blocks/<Name>/index.ts`).
  if (type === "block" || type === "inlineBlock") {
    const fields = (nodeObj.fields as Record<string, unknown> | undefined) ?? {}
    const blockType = typeof fields.blockType === "string" ? fields.blockType : undefined
    if (!blockType) return ""
    const narrate = blockDescriptor(blockType)?.narrate
    const context = narrationContext(mediaMap, extractLexicalNodeText)

    // An inline block reads as part of its sentence, so it's used bare.
    if (type === "inlineBlock") return narrate ? narrate(fields, context) : ""

    const blockText = narrate ? narrate(fields, context) : describeBlockAs(blockType, fields)
    return formatBlockContent(blockText)
  }

  // Process child nodes recursively if present
  let childrenText = ""
  if (Array.isArray(nodeObj.children)) {
    childrenText = (nodeObj.children as Record<string, unknown>[])
      .map((child) => extractLexicalNodeText(child, mediaMap))
      .join("")
  } else if (typeof nodeObj.text === "string") {
    childrenText = nodeObj.text
  }

  // Format node text based on container type
  if (type === "paragraph" || type === "quote") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed}\n\n` : ""
  }

  if (type === "heading") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed}\n\n` : ""
  }

  if (type === "listitem") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed}\n` : ""
  }

  if (type === "list") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed}\n\n` : ""
  }

  if (type === "tablecell") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed} ` : ""
  }

  if (type === "tablerow") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed}\n` : ""
  }

  return childrenText
}

export function extractNarrationText(options: ExtractNarrationTextOptions): string {
  const { title, authors, publishedAt, content, mediaMap } = options
  const parts: string[] = []

  // 1. Title
  if (title && title.trim()) {
    parts.push(title.trim())
  }

  // 2. Authors
  const authorNames: string[] = []
  if (Array.isArray(authors)) {
    for (const auth of authors) {
      if (
        typeof auth === "object" &&
        auth &&
        "name" in auth &&
        typeof auth.name === "string" &&
        auth.name.trim()
      ) {
        authorNames.push(auth.name.trim())
      } else if (typeof auth === "string" && auth.trim()) {
        authorNames.push(auth.trim())
      }
    }
  }

  if (authorNames.length > 0) {
    parts.push(`By ${authorNames.join(", ")}`)
  }

  // 3. Published Date
  if (publishedAt) {
    const formattedDate = formatLongDate(publishedAt)
    if (formattedDate) parts.push(`Published on ${formattedDate}`)
  }

  let byline = parts.join("\n")
  if (byline) {
    byline += "\n\n"
  }

  // 4. Content body
  let bodyText = ""
  if (content && typeof content === "object") {
    bodyText = extractLexicalNodeText(content as Record<string, unknown>, mediaMap)
  }

  const fullText = `${byline}${bodyText}`.replace(/\n{3,}/g, "\n\n").trim()
  return fullText
}
