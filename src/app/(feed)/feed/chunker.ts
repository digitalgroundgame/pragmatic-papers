import { getFeedBlockBehavior } from "./blocks/registry"
import type { ArticlePageItem, BlockPageKind, FeedArticle, LexicalNode, ProseChunk } from "./types"

const HEADING_TYPES = new Set(["heading"])
const TARGET_WORDS_PER_PAGE = 180

function getBlockType(node: LexicalNode): string | null {
  if (node.type !== "block") return null
  const fields = node.fields as { blockType?: string } | undefined
  return fields?.blockType ?? null
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
    const behavior = blockType ? getFeedBlockBehavior(blockType) : null

    // Split: one page per synthetic node returned from the sidecar.
    // The pending heading attaches to only the first emitted page.
    if (behavior?.placement === "split" && behavior.split) {
      flushBuffer()
      const syntheticNodes = behavior.split(node)
      let first = true
      for (const synth of syntheticNodes) {
        const synthType = getBlockType(synth) ?? blockType!
        const page: BlockPageKind = {
          kind: "block",
          node: synth,
          blockType: synthType,
          headingNode: first && pendingHeading ? pendingHeading : undefined,
        }
        pages.push(page)
        first = false
      }
      // No images / empty split: fall back to rendering the original block full-bleed
      // so we don't silently drop content.
      if (first) {
        const page: BlockPageKind = {
          kind: "block",
          node,
          blockType: blockType!,
          headingNode: pendingHeading ?? undefined,
        }
        pages.push(page)
      }
      pendingHeading = null
      continue
    }

    // Full-bleed: own page.
    if (behavior?.placement === "full-bleed") {
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

    // Inline (registered or default): rides in prose.
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

export const __test__ = { TARGET_WORDS_PER_PAGE }
