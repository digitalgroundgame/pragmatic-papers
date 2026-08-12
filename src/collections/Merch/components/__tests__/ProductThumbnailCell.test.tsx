import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ProductThumbnailCell } from "../ProductThumbnailCell"

afterEach(cleanup)

describe("ProductThumbnailCell", () => {
  it("renders the product shot straight from the store's CDN", () => {
    const { container } = render(
      <ProductThumbnailCell cellData="https://cdn.shopify.com/tee.jpg" />,
    )

    const img = container.querySelector("img")
    expect(img?.getAttribute("src")).toBe("https://cdn.shopify.com/tee.jpg")
    // Decorative: the title sits in the next column, so announcing the image
    // twice would only add noise.
    expect(img?.getAttribute("alt")).toBe("")
    expect(img?.getAttribute("loading")).toBe("lazy")
  })

  it("falls back to a dash for a product with no image", () => {
    render(<ProductThumbnailCell cellData={null} />)

    expect(screen.getByLabelText("No image")).toBeTruthy()
  })
})
