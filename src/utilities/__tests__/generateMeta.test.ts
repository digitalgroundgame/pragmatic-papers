import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Article, Media } from "@/payload-types"
import { generateMeta } from "@/utilities/generateMeta"

const SITE = "https://pragmaticpapers.com"
const OG_IMAGE = "https://cdn.example.com/media/hero-og.jpg"

const DEFAULT_OG_IMAGES = [
  {
    url: expect.stringMatching(/\/the-pragmatic-papers-opengraph-image\.png$/),
    alt: expect.any(String),
  },
]

const article = (meta: Article["meta"]): Partial<Article> => ({ meta })

const media = (ogUrl?: string): Media =>
  ({ id: 1, sizes: { og: ogUrl ? { url: ogUrl } : {} } }) as unknown as Media

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", SITE)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("generateMeta", () => {
  it("builds title, description, canonical, Open Graph and Twitter tags from the doc", async () => {
    const meta = await generateMeta({
      doc: article({ title: "The Case", description: "Why it matters", image: media(OG_IMAGE) }),
      canonicalPath: "/articles/the-case",
    })

    expect(meta).toEqual({
      title: "The Case",
      description: "Why it matters",
      alternates: { canonical: `${SITE}/articles/the-case` },
      openGraph: {
        type: "website",
        siteName: "The Pragmatic Papers",
        title: "The Case",
        description: "Why it matters",
        url: `${SITE}/articles/the-case`,
        images: [{ url: OG_IMAGE }],
      },
      twitter: {
        card: "summary_large_image",
        title: "The Case",
        description: "Why it matters",
        images: [OG_IMAGE],
      },
    })
  })

  it("falls back to the site title and image for a missing doc", async () => {
    const meta = await generateMeta({ doc: null, canonicalPath: "/" })

    expect(meta.title).toBe("The Pragmatic Papers")
    expect(meta.description).toBeUndefined()
    expect(meta.alternates?.canonical).toBe(`${SITE}/`)
    expect(meta.openGraph?.images).toEqual(DEFAULT_OG_IMAGES)
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      title: "The Pragmatic Papers",
      description: undefined,
      images: undefined,
    })
  })

  it("uses the site image when the meta image is not populated", async () => {
    const meta = await generateMeta({ doc: article({ image: 7 }), canonicalPath: "/about" })

    expect(meta.openGraph?.images).toEqual(DEFAULT_OG_IMAGES)
    expect(meta.twitter).toMatchObject({ images: undefined })
  })

  it.each([
    ["no meta description", article({ title: "Untitled" })],
    ["an empty meta description", article({ title: "Untitled", description: "" })],
  ])("keeps the site's default Open Graph description for a doc with %s", async (_, doc) => {
    const meta = await generateMeta({ doc, canonicalPath: "/about" })

    expect(meta.openGraph?.description).toEqual(expect.stringContaining("community-driven"))
  })

  it("uses the site image when the media has no og size", async () => {
    const meta = await generateMeta({ doc: article({ image: media() }), canonicalPath: "/about" })

    expect(meta.openGraph?.images).toEqual(DEFAULT_OG_IMAGES)
    expect(meta.twitter).toMatchObject({ images: undefined })
  })
})
