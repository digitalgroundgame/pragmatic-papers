import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from "@payloadcms/richtext-lexical/lexical"

export interface ExtractNarrationTextOptions {
  title?: string | null
  authors?: Array<{ name?: string | null } | string | number> | null
  populatedAuthors?: Array<{ name?: string | null }> | null
  publishedAt?: string | Date | null
  content?: SerializedEditorState | Record<string, unknown> | null
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
  blueskyEmbed: "Bluesky Embed",
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

/**
  Recursively extract plain text from a Lexical node structure or editor state.
 */
function extractLexicalNodeText(node: SerializedLexicalNode | Record<string, unknown>): string {
  if (!node || typeof node !== "object") return ""

  const nodeObj = node as Record<string, unknown>

  if (nodeObj.root && typeof nodeObj.root === "object") {
    return extractLexicalNodeText(nodeObj.root as SerializedLexicalNode)
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

    if (blockType === "inlineMathBlock") {
      if (typeof fields.description === "string" && fields.description.trim()) {
        return fields.description.trim()
      }
      return getFallbackTextForBlock("inlineMathBlock")
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
    if (typeof fields.description === "string" && fields.description.trim()) {
      blockText = fields.description.trim()
    } else if (blockType === "banner" && fields.content && typeof fields.content === "object") {
      blockText = extractLexicalNodeText(fields.content as SerializedLexicalNode).trim()
    } else if (blockType === "mediaBlock" && fields.media && typeof fields.media === "object") {
      const mediaObj = fields.media as Record<string, unknown>
      if (typeof mediaObj.alt === "string" && mediaObj.alt.trim()) {
        blockText = mediaObj.alt.trim()
      } else if (mediaObj.caption && typeof mediaObj.caption === "object") {
        blockText = extractLexicalNodeText(mediaObj.caption as SerializedLexicalNode).trim()
      }
    } else if (
      blockType === "socialEmbed" &&
      fields.snapshot &&
      typeof fields.snapshot === "object"
    ) {
      const snap = fields.snapshot as Record<string, unknown>
      if (typeof snap.title === "string" && snap.title.trim()) {
        blockText = snap.title.trim()
      }
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
      .map((child) => extractLexicalNodeText(child))
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
    return trimmed ? `${trimmed}\n<break time="1.0s" />\n\n` : ""
  }

  if (type === "listitem") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed}\n` : ""
  }

  if (type === "list") {
    const trimmed = childrenText.trim()
    return trimmed ? `${trimmed}\n\n` : ""
  }

  if (type === "root") {
    return childrenText
  }

  return childrenText
}

export function extractNarrationText(options: ExtractNarrationTextOptions): string {
  const { title, authors, populatedAuthors, publishedAt, content } = options
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
    byline += '\n<break time="1.5s" />\n\n'
  }

  // 4. Content body
  let bodyText = ""
  if (content && typeof content === "object") {
    bodyText = extractLexicalNodeText(content as Record<string, unknown>)
  }

  const fullText = `${byline}${bodyText}`.replace(/\n{3,}/g, "\n\n").trim()
  return fullText
}
