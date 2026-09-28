import type { PayloadRequest } from "payload"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { generatePreviewPath } from "@/utilities/generatePreviewPath"

type Collection = Parameters<typeof generatePreviewPath>[0]["collection"]

const req = {} as PayloadRequest

/** The params as the preview route reads them, after one round of URL decoding. */
const params = (collection: Collection, slug: string): Record<string, string> => {
  const path = generatePreviewPath({ collection, slug, req })
  expect(path).not.toBeNull()

  const url = new URL(path!, "http://localhost")
  expect(url.pathname).toBe("/next/preview")

  return Object.fromEntries(url.searchParams)
}

beforeEach(() => {
  vi.stubEnv("PREVIEW_SECRET", "s3cret")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("generatePreviewPath", () => {
  it("previews a page at the site root", () => {
    expect(params("pages", "about")).toEqual({
      slug: "about",
      collection: "pages",
      path: "/about",
      previewSecret: "s3cret",
    })
  })

  it("prefixes articles and volumes with their collection", () => {
    expect(params("articles", "the-case").path).toBe("/articles/the-case")
    expect(params("volumes", "7").path).toBe("/volumes/7")
  })

  it("previews the homepage from an empty slug", () => {
    expect(params("pages", "")).toMatchObject({ slug: "", path: "/" })
  })

  it("returns null when there is no slug", () => {
    for (const slug of [undefined, null]) {
      expect(
        generatePreviewPath({ collection: "pages", slug: slug as unknown as string, req }),
      ).toBeNull()
    }
  })

  it("keeps special characters encoded in the redirect path", () => {
    expect(params("articles", "a b/c?d")).toMatchObject({
      slug: "a%20b%2Fc%3Fd",
      path: "/articles/a%20b%2Fc%3Fd",
    })
  })

  it("sends an empty secret when PREVIEW_SECRET is unset", () => {
    vi.stubEnv("PREVIEW_SECRET", undefined)

    expect(params("pages", "about").previewSecret).toBe("")
  })
})
