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

describe("Interactives fields for a whip count", () => {
  type Named = { name?: string; fields?: Named[]; tabs?: { fields: Named[] }[] } & {
    admin?: { condition?: (data: Record<string, unknown>) => boolean }
  }
  const find = (fields: Named[], name: string): Named | undefined => {
    for (const field of fields) {
      if (field.name === name) return field
      const nested = field.fields ?? field.tabs?.flatMap((tab) => tab.fields)
      const found = nested && find(nested, name)
      if (found) return found
    }
    return undefined
  }
  const shown = (name: string, profile: string): boolean =>
    find(Interactives.fields as Named[], name)!.admin!.condition!({ profile })

  it("offers both kinds of interactive", () => {
    const profile = find(Interactives.fields as Named[], "profile") as {
      options: { value: string }[]
    }
    expect(profile.options.map((option) => option.value)).toEqual(["federal-courts", "whip-count"])
  })

  it("asks a whip count for its methodology, and a map for its feed's branch", () => {
    expect(shown("methodology", "whip-count")).toBe(true)
    expect(shown("methodology", "federal-courts")).toBe(false)
    expect(shown("ref", "whip-count")).toBe(false)
    expect(shown("ref", "federal-courts")).toBe(true)
    expect(shown("enabled", "whip-count")).toBe(false)
  })
})
