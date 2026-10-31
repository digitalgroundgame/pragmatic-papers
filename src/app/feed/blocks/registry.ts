import type { FeedBlockBehavior } from "@/blocks/feed/types"
import { blocksWith } from "@/blocks/registry"
import { tableFeed } from "./table"

// Each block declares its reading-feed behavior as `readingFeed` in its descriptor
// (`src/blocks/<Name>/index.ts`). Lexical's native table nodes aren't a Payload block:
// the chunker gives them a virtual blockType "table".
const registry: Record<string, FeedBlockBehavior> = {
  ...blocksWith("readingFeed"),
  table: tableFeed,
}

const DEFAULT_BEHAVIOR: FeedBlockBehavior = { placement: "inline" }

export function getFeedBlockBehavior(blockType: string): FeedBlockBehavior {
  return registry[blockType] ?? DEFAULT_BEHAVIOR
}
