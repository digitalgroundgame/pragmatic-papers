import { Banner } from "@/blocks/Banner/config"
import { Code } from "@/blocks/Code/config"
import { MediaBlock } from "@/blocks/MediaBlock/config"
import { SquiggleRule } from "@/blocks/SquiggleRule/config"
import type { Block } from "payload"

/**
 * Blocks allowed in a volume's editor's note. Shared with the RSS feed's
 * converter test, so every block added here needs a feed converter too.
 */
export const editorsNoteBlocks: Block[] = [Banner, Code, MediaBlock, SquiggleRule]
