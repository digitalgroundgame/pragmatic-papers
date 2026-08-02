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

// Human-readable, lower-cased nouns for blocks that fall through to the generic
// descriptor. Proper-noun blocks (embeds, media, math) are handled explicitly
// below so their branding/casing survives.
const BLOCK_TYPE_NAMES: Record<string, string> = {
  cta: "call to action",
  collectionGrid: "collection grid",
  content: "content block",
  contributors: "contributors block",
  formBlock: "form",
  newsletterSignup: "newsletter signup",
  volumeView: "volume view",
}

// Provider-aware descriptions for social/media embeds. We never read the raw
// URL aloud — a spoken URL is unintelligible — so each embed collapses to a
// short "an embedded X" noun phrase.
const EMBED_DESCRIPTIONS: Record<string, string> = {
  youtubeEmbed: "an embedded YouTube video",
  tiktokEmbed: "an embedded TikTok video",
  twitterEmbed: "an embedded Twitter post",
  redditEmbed: "an embedded Reddit post",
  blueSkyEmbed: "an embedded Bluesky post",
}

/**
 * Turn a bare noun phrase into a full "described visual" sentence that reads
 * naturally in a text-to-speech engine like ElevenLabs, e.g.
 *   describeVisual('a timeline titled "Fall of Rome"')
 *     -> 'A timeline titled "Fall of Rome" is shown here.'
 *   describeVisual('an image', 'crowds gather outside the courthouse')
 *     -> 'An image is shown here: crowds gather outside the courthouse.'
 *
 * `detail` (a caption or alt description) is appended after the frame so the
 * listener hears what the visual contains without any bracketed markers.
 */
function describeVisual(nounPhrase: string, detail?: string): string {
  const trimmedDetail = detail?.trim()
  let sentence = trimmedDetail
    ? `${nounPhrase} is shown here: ${trimmedDetail}`
    : `${nounPhrase} is shown here`
  sentence = sentence.trim()
  if (!/[.!?]$/.test(sentence)) sentence += "."
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

function indefiniteArticle(noun: string): "a" | "an" {
  return /^[aeiou]/i.test(noun) ? "an" : "a"
}

/**
 * Build a spoken-friendly description for a visual/non-text block. Visual
 * elements can't be narrated directly, so each is described as an aside the
 * ElevenLabs voice can read verbatim — no double-angle-bracket markers, no
 * all-caps block names (which TTS engines spell out letter by letter), and no
 * raw LaTeX or URLs.
 */
function describeBlock(blockType: string, fields: Record<string, unknown>): string {
  if (blockType === "mediaBlock") {
    return describeVisual("an image")
  }

  if (blockType === "mediaCollage") {
    return describeVisual("a gallery of images")
  }

  if (blockType === "timeline") {
    const title = typeof fields.title === "string" ? fields.title.trim() : ""
    return describeVisual(title ? `a timeline titled "${title}"` : "a timeline")
  }

  if (blockType === "interactiveMap") {
    const title = typeof fields.widgetTitle === "string" ? fields.widgetTitle.trim() : ""
    return describeVisual(title ? `an interactive map titled "${title}"` : "an interactive map")
  }

  if (blockType === "code") {
    const language = typeof fields.language === "string" ? fields.language.trim() : ""
    return describeVisual(language ? `a code sample in ${language}` : "a code sample")
  }

  // Never read raw LaTeX aloud — collapse any math block to a spoken description.
  if (blockType === "displayMathBlock" || blockType === "inlineMathBlock") {
    return describeVisual("a mathematical formula")
  }

  const embedDescription = EMBED_DESCRIPTIONS[blockType]
  if (embedDescription) {
    return describeVisual(embedDescription)
  }

  if (blockType === "socialEmbed") {
    const platform = typeof fields.platform === "string" ? fields.platform.trim() : ""
    return describeVisual(
      platform ? `an embedded ${platform} post` : "an embedded social media post",
    )
  }

  // Generic fallback for any remaining block type. Only human-readable title/
  // name/label strings become a "titled" clause — slugs, ids, and numbers read
  // terribly aloud and are dropped.
  const noun = BLOCK_TYPE_NAMES[blockType] || blockType
  let titled = ""
  for (const key of ["title", "name", "label"]) {
    if (typeof fields[key] === "string" && (fields[key] as string).trim()) {
      titled = ` titled "${(fields[key] as string).trim()}"`
      break
    }
  }
  return describeVisual(`${indefiniteArticle(noun)} ${noun}${titled}`)
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
      // Inline within a sentence — a short noun phrase, not a full aside. Raw
      // LaTeX is never read aloud.
      return "a mathematical formula"
    }

    return ""
  }

  // Handle block nodes (e.g. custom blocks like Banner, MediaBlock, Code, etc.)
  if (type === "block") {
    const fields = (nodeObj.fields as Record<string, unknown> | undefined) ?? {}
    const blockType = fields.blockType as string | undefined

    // Resolve a spoken description for a media reference: the caption (preferred)
    // or the alt text. Filenames and numeric ids are intentionally omitted —
    // they read terribly aloud and add no narration value, so a media block with
    // neither caption nor alt simply narrates as "An image is shown here."
    const resolveMediaDescription = (mediaVal: unknown): string => {
      const mediaInfo = resolveMediaInfo(mediaVal, mediaMap)
      if (!mediaInfo) return ""

      if (mediaInfo.caption && typeof mediaInfo.caption === "object") {
        const caption = extractLexicalNodeText(
          mediaInfo.caption as SerializedLexicalNode,
          mediaMap,
        ).trim()
        if (caption) return caption
      }

      if (typeof mediaInfo.alt === "string" && mediaInfo.alt.trim()) {
        return mediaInfo.alt.trim()
      }

      return ""
    }

    let blockText = ""
    if (blockType === "mediaBlock" && fields.media) {
      const description = resolveMediaDescription(fields.media)
      blockText = describeVisual("an image", description)
    } else if (blockType === "mediaCollage" && Array.isArray(fields.images)) {
      const descriptions: string[] = []
      for (const img of fields.images as Record<string, unknown>[]) {
        if (img && typeof img === "object" && img.media) {
          const description = resolveMediaDescription(img.media)
          if (description) descriptions.push(description)
        }
      }
      if (Array.isArray(fields.images) && fields.images.length > 0) {
        blockText = describeVisual("a gallery of images", descriptions.join("; "))
      }
    } else if (blockType === "banner" && fields.content && typeof fields.content === "object") {
      // A banner carries real, readable prose — narrate it as a set-apart note
      // rather than describing it as a visual.
      const text = extractLexicalNodeText(fields.content as SerializedLexicalNode, mediaMap).trim()
      blockText = text ? `Note: ${text}` : ""
    }

    if (!blockText && blockType) {
      blockText = describeBlock(blockType, fields)
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
