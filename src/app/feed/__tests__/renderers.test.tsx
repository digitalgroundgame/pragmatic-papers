import { describe, expect, it, vi } from "vitest"
import { block, makeFeedArticle } from "./fixtures"

vi.mock("server-only", () => ({}))
vi.mock("@/components/RichText", () => ({ default: () => null }))

const { renderFeedBlock } = await import("../blocks/renderers")
const { MediaBlockFeed } = await import("@/blocks/MediaBlock/MediaBlockFeed")
const { FeedTableRowReflow } = await import("../blocks/FeedTableRowReflow")

const props = { node: block("x"), article: makeFeedArticle() }
const typeOf = (blockType: string) =>
  (renderFeedBlock(blockType, props) as { type?: unknown } | undefined)?.type

describe("renderFeedBlock", () => {
  it("routes the blocks the feed draws its own way", () => {
    expect(typeOf("mediaBlock")).toBe(MediaBlockFeed)
    expect(typeOf("table")).toBe(FeedTableRowReflow)
  })

  it("leaves every other block to the RichText converters", () => {
    expect(renderFeedBlock("socialEmbed", props)).toBeUndefined()
  })
})
