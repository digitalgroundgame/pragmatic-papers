import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"

export type MediaMap = Record<
  string | number,
  { alt?: string | null; caption?: unknown; filename?: string | null }
>

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
  cta: "Call to Action",
  collectionGrid: "Collection Grid",
  content: "Content",
  contributors: "Contributors",
  formBlock: "Form",
  interactiveMap: "Interactive Map",
  mediaBlock: "Media Block",
  mediaCollage: "Media Collage",
  displayMathBlock: "Display Math Block",
  inlineMathBlock: "Inline Math Block",
  newsletterSignup: "Newsletter Signup",
  socialEmbed: "Social Embed",
  timeline: "Timeline",
  twitterEmbed: "Twitter Embed",
  youtubeEmbed: "YouTube Embed",
  redditEmbed: "Reddit Embed",
  blueSkyEmbed: "Bluesky Embed",
  tiktokEmbed: "TikTok Embed",
  volumeView: "Volume View",
}

function getFallbackPlaceholder(blockType: string, fields: Record<string, unknown>): string {
  const name = (BLOCK_TYPE_NAMES[blockType] || blockType).toUpperCase()

  let detail = ""
  if (blockType === "code") {
    detail = typeof fields.language === "string" ? fields.language : ""
  } else if (blockType === "interactiveMap") {
    detail = typeof fields.widgetTitle === "string" ? fields.widgetTitle : ""
  } else if (blockType === "timeline") {
    detail = typeof fields.title === "string" ? fields.title : ""
  } else if (blockType === "inlineMathBlock" || blockType === "displayMathBlock") {
    detail = typeof fields.math === "string" ? fields.math : ""
  } else if (blockType.endsWith("Embed") || blockType === "socialEmbed") {
    const parts: string[] = []
    if (typeof fields.platform === "string") parts.push(fields.platform)
    if (typeof fields.url === "string") parts.push(fields.url)
    detail = parts.join(": ")
  }

  if (!detail) {
    const potentialKeys = ["title", "name", "slug", "label", "id"]
    for (const key of potentialKeys) {
      if (typeof fields[key] === "string" && fields[key]) {
        detail = fields[key] as string
        break
      }
      if (typeof fields[key] === "number") {
        detail = String(fields[key])
        break
      }
    }
  }

  return detail ? `<< ${name}: ${detail} >>` : `<< ${name} >>`
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
  } else if (typeof mediaVal === "object" && mediaVal !== null && !Array.isArray(mediaVal)) {
    const obj = mediaVal as Record<string, unknown>
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

  // Handle inline blocks (e.g. footnotes, inline math)
  if (type === "inlineBlock") {
    const fields = (nodeObj.fields as Record<string, unknown> | undefined) ?? {}
    const blockType = fields.blockType as string | undefined

    if (blockType === "footnote") {
      // Footnotes omitted entirely per requirements
      return ""
    }

    if (blockType === "inlineMathBlock") {
      const math = typeof fields.math === "string" ? fields.math : ""
      return math ? `<< INLINE MATH BLOCK: ${math} >>` : "<< INLINE MATH BLOCK >>"
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
        let extractedCaption = ""
        if (mediaInfo.caption && typeof mediaInfo.caption === "object") {
          extractedCaption = extractLexicalNodeText(
            mediaInfo.caption as SerializedLexicalNode,
            mediaMap,
          ).trim()
        }

        if (extractedCaption) {
          blockText = extractedCaption
        } else if (typeof mediaInfo.alt === "string" && mediaInfo.alt.trim()) {
          blockText = mediaInfo.alt.trim()
        } else {
          const detail = mediaInfo.filename || (mediaInfo.id ? `ID: ${mediaInfo.id}` : "")
          blockText = detail ? `<< MEDIA BLOCK: ${detail} >>` : "<< MEDIA BLOCK >>"
        }
      } else {
        let mediaDetail = ""
        if (typeof fields.media === "string" || typeof fields.media === "number") {
          mediaDetail = `ID: ${fields.media}`
        } else if (typeof fields.media === "object" && fields.media !== null) {
          const mediaObj = fields.media as Record<string, unknown>
          mediaDetail = (mediaObj.filename as string) || (mediaObj.id ? `ID: ${mediaObj.id}` : "")
        }
        blockText = mediaDetail ? `<< MEDIA BLOCK: ${mediaDetail} >>` : "<< MEDIA BLOCK >>"
      }
    } else if (blockType === "mediaCollage" && Array.isArray(fields.images)) {
      const collageTexts: string[] = []
      for (const img of fields.images as Record<string, unknown>[]) {
        if (img && typeof img === "object" && img.media) {
          const mediaInfo = resolveMediaInfo(img.media, mediaMap)
          if (mediaInfo) {
            let extractedCaption = ""
            if (mediaInfo.caption && typeof mediaInfo.caption === "object") {
              extractedCaption = extractLexicalNodeText(
                mediaInfo.caption as SerializedLexicalNode,
                mediaMap,
              ).trim()
            }

            if (extractedCaption) {
              collageTexts.push(extractedCaption)
            } else if (typeof mediaInfo.alt === "string" && mediaInfo.alt.trim()) {
              collageTexts.push(mediaInfo.alt.trim())
            } else {
              const detail = mediaInfo.filename || (mediaInfo.id ? `ID: ${mediaInfo.id}` : "")
              collageTexts.push(detail ? `<< MEDIA BLOCK: ${detail} >>` : "<< MEDIA BLOCK >>")
            }
          } else {
            let imgDetail = ""
            if (typeof img.media === "string" || typeof img.media === "number") {
              imgDetail = `ID: ${img.media}`
            } else if (typeof img.media === "object" && img.media !== null) {
              const mediaObj = img.media as Record<string, unknown>
              imgDetail = (mediaObj.filename as string) || (mediaObj.id ? `ID: ${mediaObj.id}` : "")
            }
            collageTexts.push(imgDetail ? `<< MEDIA BLOCK: ${imgDetail} >>` : "<< MEDIA BLOCK >>")
          }
        }
      }
      if (collageTexts.length > 0) {
        blockText = collageTexts.join("\n")
      }
    }

    if (!blockText) {
      if (blockType === "banner" && fields.content && typeof fields.content === "object") {
        blockText = extractLexicalNodeText(fields.content as SerializedLexicalNode, mediaMap).trim()
      }
    }

    if (!blockText && blockType) {
      blockText = getFallbackPlaceholder(blockType, fields)
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
