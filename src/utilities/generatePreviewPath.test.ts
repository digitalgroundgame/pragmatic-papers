import { describe, it, expect } from "vitest"
import { generatePreviewPath } from "./generatePreviewPath"

describe("generatePreviewPath", () => {
  it("returns null for undefined slug", () => {
    expect(
      generatePreviewPath({ collection: "pages", slug: undefined as unknown as string }),
    ).toBeNull()
  })

  it("returns null for null slug", () => {
    expect(generatePreviewPath({ collection: "pages", slug: null as unknown as string })).toBeNull()
  })

  it("generates preview path for pages", () => {
    const result = generatePreviewPath({ collection: "pages", slug: "about" })
    expect(result).toContain("/next/preview?")
    expect(result).toContain("slug=about")
    expect(result).toContain("collection=pages")
    expect(result).toContain("path=")
  })

  it("generates preview path for articles", () => {
    const result = generatePreviewPath({ collection: "articles", slug: "my-article" })
    expect(result).toContain("collection=articles")
    expect(result).toContain("path=%2Farticles%2Fmy-article")
  })

  it("generates preview path for volumes", () => {
    const result = generatePreviewPath({ collection: "volumes", slug: "vol-1" })
    expect(result).toContain("collection=volumes")
    expect(result).toContain("path=%2Fvolumes%2Fvol-1")
  })

  it("includes preview secret from env", () => {
    const original = process.env.PREVIEW_SECRET
    process.env.PREVIEW_SECRET = "secret123"
    const result = generatePreviewPath({ collection: "pages", slug: "test" })
    expect(result).toContain("previewSecret=secret123")
    process.env.PREVIEW_SECRET = original
  })

  it("handles slugs with special characters", () => {
    const result = generatePreviewPath({ collection: "pages", slug: "page with spaces" })
    // URLSearchParams encodes spaces as '+'
    expect(result).toContain("slug=page+with+spaces")
  })

  it("handles slugs with non-ASCII characters", () => {
    const result = generatePreviewPath({ collection: "pages", slug: "café" })
    expect(result).toContain("slug=caf%C3%A9")
  })
})
