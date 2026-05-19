import type { ArticlePageItem, BlockPageKind, FeedArticle, LexicalNode, ProseChunk } from "./types"

const FULL_BLEED_BLOCK_TYPES = new Set([
  "mediaBlock",
  "mediaCollage",
  "socialEmbed",
  "timeline",
  "displayMathBlock",
  "cta",
  "contributors",
  "collectionGrid",
  "form",
  "volumeView",
  "twitterEmbed",
  "youtubeEmbed",
  "redditEmbed",
  "blueSkyEmbed",
  "tiktokEmbed",
])

const HEADING_TYPES = new Set(["heading"])

const TARGET_WORDS_PER_PAGE = 180

function getBlockType(node: LexicalNode): string | null {
  if (node.type !== "block") return null
  const fields = node.fields as { blockType?: string } | undefined
  return fields?.blockType ?? null
}

function isFullBleedBlock(node: LexicalNode): boolean {
  const blockType = getBlockType(node)
  return blockType !== null && FULL_BLEED_BLOCK_TYPES.has(blockType)
}

function isHeading(node: LexicalNode): boolean {
  return HEADING_TYPES.has(node.type)
}

export function countWordsInNode(node: LexicalNode): number {
  if (node.type === "text") {
    const text = typeof node.text === "string" ? node.text : ""
    return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length
  }
  const children = Array.isArray(node.children) ? (node.children as LexicalNode[]) : []
  let total = 0
  for (const child of children) {
    total += countWordsInNode(child)
  }
  return total
}

function countWordsInNodes(nodes: LexicalNode[]): number {
  let total = 0
  for (const node of nodes) {
    total += countWordsInNode(node)
  }
  return total
}

function makeSyntheticMediaBlock(media: unknown): LexicalNode {
  return {
    type: "block",
    version: 1,
    fields: {
      blockType: "mediaBlock",
      media,
    },
  }
}

export function chunkArticle(article: FeedArticle): ArticlePageItem[] {
  const pages: ArticlePageItem[] = [{ kind: "hero", article }]

  const root = article.content?.root as { children?: LexicalNode[] } | undefined
  const rootChildren = Array.isArray(root?.children) ? root!.children! : []

  let buffer: LexicalNode[] = []
  let bufferWords = 0
  let pendingHeading: LexicalNode | null = null

  const flushBuffer = (): void => {
    if (buffer.length === 0) return
    const chunk: ProseChunk = {
      kind: "content",
      nodes: [...buffer],
      wordCount: countWordsInNodes(buffer),
    }
    pages.push(chunk)
    buffer = []
    bufferWords = 0
  }

  for (const node of rootChildren) {
    const blockType = getBlockType(node)

    // mediaCollage → split into one page per image so no block is bigger than the screen.
    if (blockType === "mediaCollage") {
      flushBuffer()
      const fields = node.fields as { images?: Array<{ media?: unknown }> } | undefined
      const images = fields?.images ?? []
      let first = true
      for (const img of images) {
        if (!img?.media) continue
        const page: BlockPageKind = {
          kind: "block",
          node: makeSyntheticMediaBlock(img.media),
          blockType: "mediaBlock",
          headingNode: first && pendingHeading ? pendingHeading : undefined,
        }
        pages.push(page)
        first = false
      }
      // If the collage had no images, fall back to rendering the original block
      if (first) {
        const page: BlockPageKind = {
          kind: "block",
          node,
          blockType: "mediaCollage",
          headingNode: pendingHeading ?? undefined,
        }
        pages.push(page)
      }
      pendingHeading = null
      continue
    }

    if (isFullBleedBlock(node)) {
      flushBuffer()
      const page: BlockPageKind = {
        kind: "block",
        node,
        blockType: blockType!,
        headingNode: pendingHeading ?? undefined,
      }
      pages.push(page)
      pendingHeading = null
      continue
    }

    // Defer headings — never emit them on a page alone. They join whatever comes next.
    if (isHeading(node)) {
      flushBuffer()
      pendingHeading = node
      continue
    }

    // Normal prose: drop the pending heading at the top of the next chunk.
    if (pendingHeading) {
      buffer.push(pendingHeading)
      bufferWords += countWordsInNode(pendingHeading)
      pendingHeading = null
    }

    const nodeWords = countWordsInNode(node)
    if (bufferWords + nodeWords > TARGET_WORDS_PER_PAGE && buffer.length > 0) {
      flushBuffer()
    }
    buffer.push(node)
    bufferWords += nodeWords
  }

  // Tail: a heading that never found a follower still has to go somewhere.
  if (pendingHeading) {
    buffer.push(pendingHeading)
    pendingHeading = null
  }
  flushBuffer()

  return pages
}

export const __test__ = { TARGET_WORDS_PER_PAGE, FULL_BLEED_BLOCK_TYPES }
