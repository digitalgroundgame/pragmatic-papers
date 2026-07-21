import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"

export type MediaMap = Record<string | number, { alt?: string | null; caption?: unknown }>

export interface ExtractNarrationTextOptions {
  title?: string | null
  authors?: Array<{ name?: string | null } | string | number> | null
  populatedAuthors?: Array<{ name?: string | null }> | null
  publishedAt?: string | Date | null
  content?: SerializedEditorState | Record<string, unknown> | null
  mediaMap?: MediaMap | null
}

const BLOCK_TYPE_NAMES: Record<string, string> = {
  banner: "Banner",
  code: "Code",
  interactiveMap: "Interactive Map",
  mediaBlock: "Media Block",
  mediaCollage: "Media Collage",
  displayMathBlock: "Display Math Block",
  inlineMathBlock: "Inline Math Block",
  socialEmbed: "Social Embed",
  timeline: "Timeline",
  twitterEmbed: "Twitter Embed",
  youtubeEmbed: "YouTube Embed",
  redditEmbed: "Reddit Embed",
  blueSkyEmbed: "Bluesky Embed",
  tiktokEmbed: "TikTok Embed",
}

function getFallbackTextForBlock(blockType: string): string {
  const name = BLOCK_TYPE_NAMES[blockType] || blockType
  return `To view this ${name}, please refer to the article.`
}

function formatBlockContent(text: string): string {
  const trimmed = text.trim()
  return trimmed ? `${trimmed}\n\n` : ""
}

function resolveMediaInfo(
  mediaVal: unknown,
  mediaMap?: MediaMap | null,
): { alt?: string | null; caption?: unknown } | null {
  if (!mediaVal) return null

  let mediaId: string | number | null = null
  let mediaObj: Record<string, unknown> | null = null

  if (typeof mediaVal === "number" || typeof mediaVal === "string") {
    mediaId = mediaVal
  } else if (typeof mediaVal === "object" && mediaVal !== null) {
    const obj = mediaVal as Record<string, unknown>
    if (typeof obj.alt === "string" || obj.caption) {
      mediaObj = obj
    } else if ("value" in obj && typeof obj.value === "object" && obj.value !== null) {
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
    }
  }

  if (mediaId !== null && mediaMap && mediaMap[mediaId]) {
    return mediaMap[mediaId] ?? null
  }

  return null
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

  // Handle inline blocks (e.g. footnotes, inline math)
  if (type === "inlineBlock") {
    const fields = (nodeObj.fields as Record<string, unknown> | undefined) ?? {}
    const blockType = fields.blockType as string | undefined

    if (blockType === "footnote") {
      // Footnotes omitted entirely per requirements
      return ""
    }

    if (typeof fields.description === "string" && fields.description.trim()) {
      return fields.description.trim()
    }

    if (blockType) {
      return getFallbackTextForBlock(blockType)
    }

    return ""
  }

  // Handle block nodes (e.g. custom blocks like Banner, MediaBlock, Code, etc.)
  if (type === "block") {
    const fields = (nodeObj.fields as Record<string, unknown> | undefined) ?? {}
    const blockType = fields.blockType as string | undefined

    let blockText = ""
    if (blockType === "mediaBlock" && fields.media) {
      const mediaInfo = resolveMediaInfo(fields.media, mediaMap)
      if (mediaInfo) {
        if (typeof mediaInfo.alt === "string" && mediaInfo.alt.trim()) {
          blockText = mediaInfo.alt.trim()
        } else if (mediaInfo.caption && typeof mediaInfo.caption === "object") {
          const captionText = extractLexicalNodeText(
            mediaInfo.caption as SerializedLexicalNode,
            mediaMap,
          ).trim()
          if (captionText) {
            blockText = captionText
          }
        }
      }
    } else if (blockType === "mediaCollage" && Array.isArray(fields.images)) {
      const collageTexts: string[] = []
      for (const img of fields.images as Record<string, unknown>[]) {
        if (img && typeof img === "object" && img.media) {
          const mediaInfo = resolveMediaInfo(img.media, mediaMap)
          if (mediaInfo) {
            if (typeof mediaInfo.alt === "string" && mediaInfo.alt.trim()) {
              collageTexts.push(mediaInfo.alt.trim())
            } else if (mediaInfo.caption && typeof mediaInfo.caption === "object") {
              const captionText = extractLexicalNodeText(
                mediaInfo.caption as SerializedLexicalNode,
                mediaMap,
              ).trim()
              if (captionText) {
                collageTexts.push(captionText)
              }
            }
          }
        }
      }
      if (collageTexts.length > 0) {
        blockText = collageTexts.join("\n")
      }
    }

    if (!blockText && typeof fields.description === "string" && fields.description.trim()) {
      blockText = fields.description.trim()
    } else if (
      !blockText &&
      blockType === "banner" &&
      fields.content &&
      typeof fields.content === "object"
    ) {
      blockText = extractLexicalNodeText(fields.content as SerializedLexicalNode, mediaMap).trim()
    }

    if (!blockText && blockType) {
      blockText = getFallbackTextForBlock(blockType)
    }

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

  return childrenText
}

export function extractNarrationText(options: ExtractNarrationTextOptions): string {
  const { title, authors, populatedAuthors, publishedAt, content, mediaMap } = options
  const parts: string[] = []

  // 1. Title
  if (title && title.trim()) {
    parts.push(title.trim())
  }

  // 2. Authors
  const authorNames: string[] = []
  if (Array.isArray(populatedAuthors)) {
    for (const auth of populatedAuthors) {
      if (auth && typeof auth === "object" && typeof auth.name === "string" && auth.name.trim()) {
        authorNames.push(auth.name.trim())
      }
    }
  }
  if (authorNames.length === 0 && Array.isArray(authors)) {
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
    const dateObj = publishedAt instanceof Date ? publishedAt : new Date(publishedAt)
    if (!isNaN(dateObj.getTime())) {
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
      parts.push(`Published on ${formattedDate}`)
    }
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
