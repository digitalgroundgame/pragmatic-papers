import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { Media as MediaType } from "@/payload-types"

import { ImageMedia } from ".."

type ImageMediaDoc = MediaType & { mimeType: `image/${string}` }

function makeMedia(overrides: Partial<MediaType> = {}): ImageMediaDoc {
  return {
    id: 1,
    alt: "A mug",
    mimeType: "image/png",
    url: "/mug.png",
    width: 800,
    height: 600,
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  } as ImageMediaDoc
}

afterEach(cleanup)

describe("ImageMedia placeholder", () => {
  it("blurs over a preview derived from the image itself", () => {
    const { container } = render(
      <ImageMedia media={makeMedia({ blurDataURL: "data:image/png;base64,AAAA" })} />,
    )

    const img = container.querySelector("img")!
    expect(img.style.backgroundImage).toContain("data:image/png;base64,AAAA")
  })

  it("shows no placeholder at all when the image has no preview of its own", () => {
    // A remote image shaped into a Media — the Merch block's case — never had
    // bytes to derive a preview from. A stand-in blob would be a fixed colour
    // over a transparent PNG: wrong in one theme, and visible through the
    // product. Better to let the container's themed background show.
    const { container } = render(<ImageMedia media={makeMedia({ blurDataURL: null })} />)

    const img = container.querySelector("img")!
    expect(img.style.backgroundImage).toBe("")
  })
})
