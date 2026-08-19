import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// The cell reads the admin route off Payload's config provider, which needs the
// whole admin runtime. Only the route matters here.
vi.mock("@payloadcms/ui", () => ({
  useConfig: () => ({ config: { routes: { admin: "/admin" } } }),
}))

import { ProductThumbnailCell } from "../ProductThumbnailCell"

afterEach(cleanup)

describe("ProductThumbnailCell", () => {
  it("renders the product shot straight from the store's CDN", () => {
    const { container } = render(
      <ProductThumbnailCell cellData="https://cdn.shopify.com/tee.jpg" />,
    )

    const img = container.querySelector("img")
    expect(img).toHaveAttribute("src", "https://cdn.shopify.com/tee.jpg")
    // Decorative: the title sits in the next column, so announcing the image
    // twice would only add noise.
    expect(img).toHaveAttribute("alt", "")
    expect(img).toHaveAttribute("loading", "lazy")
  })

  it("falls back to a dash for a product with no image", () => {
    render(<ProductThumbnailCell cellData={null} />)

    expect(screen.getByLabelText("No image")).toBeInTheDocument()
  })

  it("opens the product when it's the row's linked column", () => {
    // A custom Cell replaces DefaultCell, link and all. Without this the row is
    // unreachable whenever the thumbnail happens to sit in first place.
    const { container } = render(
      <ProductThumbnailCell
        cellData="https://cdn.shopify.com/tee.jpg"
        link
        collectionSlug="merch"
        rowData={{ id: 7 }}
      />,
    )

    expect(container.querySelector("a")).toHaveAttribute("href", "/admin/collections/merch/7")
  })

  it("prefers a destination Payload has already worked out", () => {
    const { container } = render(
      <ProductThumbnailCell cellData="https://cdn.shopify.com/tee.jpg" link linkURL="/elsewhere" />,
    )

    expect(container.querySelector("a")).toHaveAttribute("href", "/elsewhere")
  })

  it("stays plain in any other column", () => {
    const { container } = render(
      <ProductThumbnailCell cellData="https://cdn.shopify.com/tee.jpg" collectionSlug="merch" />,
    )

    expect(container.querySelector("a")).not.toBeInTheDocument()
    expect(container.querySelector("img")).toBeInTheDocument()
  })
})
