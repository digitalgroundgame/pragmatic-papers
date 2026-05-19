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

const TARGET_WORDS_PER_PAGE = 110

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

function flushChunk(chunk: LexicalNode[], pages: ArticlePageItem[]): void {
  if (chunk.length === 0) return
  const wordCount = countWordsInNodes(chunk)
  const page: ProseChunk = {
    kind: "content",
    nodes: [...chunk],
    wordCount,
  }
  pages.push(page)
}

export function chunkArticle(article: FeedArticle): ArticlePageItem[] {
  const pages: ArticlePageItem[] = [{ kind: "hero", article }]

  const root = article.content?.root as { children?: LexicalNode[] } | undefined
  const rootChildren = Array.isArray(root?.children) ? root!.children! : []

  let buffer: LexicalNode[] = []
  let bufferWords = 0

  for (const node of rootChildren) {
    if (isFullBleedBlock(node)) {
      flushChunk(buffer, pages)
      buffer = []
      bufferWords = 0
      const blockPage: BlockPageKind = {
        kind: "block",
        node,
        blockType: getBlockType(node)!,
      }
      pages.push(blockPage)
      continue
    }

    if (isHeading(node) && buffer.length > 0) {
      flushChunk(buffer, pages)
      buffer = []
      bufferWords = 0
    }

    const nodeWords = countWordsInNode(node)
    if (bufferWords + nodeWords > TARGET_WORDS_PER_PAGE && buffer.length > 0) {
      flushChunk(buffer, pages)
      buffer = [node]
      bufferWords = nodeWords
    } else {
      buffer.push(node)
      bufferWords += nodeWords
    }
  }

  flushChunk(buffer, pages)
  return pages
}

export const __test__ = { TARGET_WORDS_PER_PAGE, FULL_BLEED_BLOCK_TYPES }
