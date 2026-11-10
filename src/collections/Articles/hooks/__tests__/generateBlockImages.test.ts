// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Article } from "@/payload-types"

const generateMapImages = vi.fn()
vi.mock("@/blocks/InteractiveMap/feedImage", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateMapImages,
}))

const { generateBlockImages } = await import("../generateBlockImages")

const map = { blockType: "interactiveMap", widgetTitle: "Turnout", maps: [{ svgAsset: 1 }] }
const content = {
  root: {
    type: "root",
    children: [
      { type: "block", fields: { blockType: "banner" } },
      { type: "block", fields: map },
    ],
  },
}

const logger = { error: vi.fn() }
const req = { payload: { logger } }

const run = (doc: Partial<Article>) =>
  generateBlockImages({ doc: { id: 9, content, ...doc }, req } as never)

beforeEach(() => {
  generateMapImages.mockReset()
  logger.error.mockReset()
})

describe("generateBlockImages", () => {
  it("draws the map blocks of an article being published", async () => {
    const doc = await run({ _status: "published" })

    expect(generateMapImages).toHaveBeenCalledWith({ blocks: [map], req })
    expect(doc).toMatchObject({ id: 9 })
  })

  it("leaves drafts and autosaves alone", async () => {
    await run({ _status: "draft" })
    expect(generateMapImages).not.toHaveBeenCalled()
  })

  it("logs a failure instead of failing the save", async () => {
    const failure = new Error("sharp is unavailable")
    generateMapImages.mockRejectedValue(failure)

    await expect(run({ _status: "published" })).resolves.toMatchObject({ id: 9 })
    expect(logger.error).toHaveBeenCalledWith({
      err: failure,
      msg: "Could not render the interactiveMap images of article 9",
    })
  })
})
