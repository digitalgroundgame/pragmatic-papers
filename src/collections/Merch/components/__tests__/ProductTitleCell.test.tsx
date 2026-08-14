import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// The cell reads the admin route off Payload's config provider, which needs the
// whole admin runtime. Only the route matters here.
vi.mock("@payloadcms/ui", () => ({
  useConfig: () => ({ config: { routes: { admin: "/admin" } } }),
}))

import { ProductTitleCell } from "../ProductTitleCell"

afterEach(cleanup)

describe("ProductTitleCell", () => {
  it("opens the product from any column, not just the first", () => {
    // Deliberately no `link` prop: Payload only sets it on the leading column,
    // and the title should reach the document wherever an editor drags it.
    const { container } = render(
      <ProductTitleCell cellData="DGG Mug" collectionSlug="merch" rowData={{ id: 7 }} />,
    )

    expect(container.querySelector("a")?.getAttribute("href")).toBe("/admin/collections/merch/7")
    expect(screen.getByText("DGG Mug")).toBeTruthy()
  })

  it("points at the trash route when the list is showing trash", () => {
    const { container } = render(
      <ProductTitleCell
        cellData="DGG Mug"
        collectionSlug="merch"
        rowData={{ id: 7 }}
        viewType="trash"
      />,
    )

    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/admin/collections/merch/trash/7",
    )
  })

  it("prefers a destination Payload has already worked out", () => {
    const { container } = render(<ProductTitleCell cellData="DGG Mug" linkURL="/elsewhere" />)

    expect(container.querySelector("a")?.getAttribute("href")).toBe("/elsewhere")
  })

  it("renders plain text rather than a dead link when there's no document", () => {
    const { container } = render(<ProductTitleCell cellData="DGG Mug" collectionSlug="merch" />)

    expect(container.querySelector("a")).toBeNull()
    expect(screen.getByText("DGG Mug")).toBeTruthy()
  })
})
