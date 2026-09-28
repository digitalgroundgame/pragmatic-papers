// @vitest-environment node
import type { PayloadRequest } from "payload"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { generatePreviewPath } = vi.hoisted(() => ({
  generatePreviewPath: vi.fn(() => "/next/preview?path=/interactives/courts"),
}))
vi.mock("@/utilities/generatePreviewPath", () => ({ generatePreviewPath }))

import { Interactives } from "../index"

const req = {} as PayloadRequest

beforeEach(() => {
  vi.clearAllMocks()
})

describe("Interactives preview", () => {
  it("points live preview at the interactive's own page", () => {
    const livePreview = Interactives.admin!.livePreview!.url as (args: {
      data: { slug?: string }
      req: PayloadRequest
    }) => string
    expect(livePreview({ data: { slug: "courts" }, req })).toBe(
      "/next/preview?path=/interactives/courts",
    )
    expect(generatePreviewPath).toHaveBeenCalledWith({
      slug: "courts",
      collection: "interactives",
      req,
    })
  })

  it("points the preview button at the same page", () => {
    const preview = Interactives.admin!.preview as (
      data: Record<string, unknown>,
      options: { req: PayloadRequest },
    ) => string
    preview({ slug: "courts" }, { req })
    expect(generatePreviewPath).toHaveBeenCalledWith({
      slug: "courts",
      collection: "interactives",
      req,
    })
  })
})
