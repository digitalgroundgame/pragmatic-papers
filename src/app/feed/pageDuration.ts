import { getFeedBlockBehavior } from "./blocks/registry"
import type { ArticlePageItem } from "./types"

const WPM = 220
const MIN_MS = 3500
const HERO_MS = 4500
const BLOCK_MS = 6000

export function getPageDurationMs(page: ArticlePageItem): number {
  switch (page.kind) {
    case "hero":
      return HERO_MS
    case "content": {
      const fromWords = (page.wordCount / WPM) * 60_000
      return Math.max(MIN_MS, fromWords)
    }
    case "block":
      return getFeedBlockBehavior(page.blockType).durationMs ?? BLOCK_MS
  }
}
