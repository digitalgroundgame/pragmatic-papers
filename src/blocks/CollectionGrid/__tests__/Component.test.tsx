import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { CollectionGridLayout } from "@/payload-types"
import { CollectionGridBlock } from "../Component"

vi.mock("../layouts/Gauss10", () => ({
  Gauss10Layout: () => <div data-testid="gauss10-layout" />,
}))

describe("CollectionGridBlock", () => {
  it("renders nothing when no layout is selected", async () => {
    const element = await CollectionGridBlock({ slots: [], blockType: "collectionGrid" })
    expect(element).toBeNull()
  })

  it("renders nothing when the layout key isn't recognized (e.g. a removed layout)", async () => {
    const element = await CollectionGridBlock({
      layout: "retired-layout" as CollectionGridLayout,
      slots: [],
      blockType: "collectionGrid",
    })
    expect(element).toBeNull()
  })

  it("renders the matching layout component when the layout is recognized", async () => {
    const element = await CollectionGridBlock({
      layout: "gauss-10",
      slots: [],
      blockType: "collectionGrid",
    })
    render(element)
    expect(screen.getByTestId("gauss10-layout")).toBeInTheDocument()
  })
})
