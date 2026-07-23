import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { CollectionGridSlots } from "@/payload-types"
import { Gauss10Layout } from "../Gauss10"

vi.mock("../../CollectionTile", () => ({
  CollectionTile: ({
    tile,
    imagePosition,
    variant,
  }: {
    tile?: { id?: string | null }
    imagePosition?: string
    variant?: string
  }) =>
    tile ? (
      <div
        data-testid={`tile-${tile.id}`}
        data-image-position={imagePosition}
        data-variant={variant}
      >
        {tile.id}
      </div>
    ) : null,
}))

afterEach(cleanup)

function makeSlot(id: string): CollectionGridSlots[number] {
  return { id, collection: { relationTo: "articles", value: 1 } }
}

function makeSlots(ids: string[]): CollectionGridSlots {
  return ids.map(makeSlot)
}

const requiredIds = ["featured", "a", "b", "c", "d", "e", "f", "g"]

describe("Gauss10Layout", () => {
  it("renders the 8 required slots and omits H and I when absent", () => {
    render(<Gauss10Layout slots={makeSlots(requiredIds)} />)

    for (const id of requiredIds) {
      expect(screen.getByTestId(`tile-${id}`)).toBeTruthy()
    }
    expect(screen.queryByTestId("tile-h")).toBeNull()
    expect(screen.queryByTestId("tile-i")).toBeNull()
  })

  it("gives G the 'left' image position when H and I are both absent", () => {
    render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
    expect(screen.getByTestId("tile-g").dataset.imagePosition).toBe("left")
  })

  it("renders H but not I when only 9 slots are provided, and switches G to 'above'", () => {
    render(<Gauss10Layout slots={makeSlots([...requiredIds, "h"])} />)

    expect(screen.getByTestId("tile-h")).toBeTruthy()
    expect(screen.queryByTestId("tile-i")).toBeNull()
    expect(screen.getByTestId("tile-g").dataset.imagePosition).toBe("above")
  })

  it("renders H and I with 'above' image position when all 10 slots are provided", () => {
    render(<Gauss10Layout slots={makeSlots([...requiredIds, "h", "i"])} />)

    expect(screen.getByTestId("tile-h").dataset.imagePosition).toBe("above")
    expect(screen.getByTestId("tile-i").dataset.imagePosition).toBe("above")
    expect(screen.getByTestId("tile-g").dataset.imagePosition).toBe("above")
  })

  it("marks the featured slot with 'above' image position", () => {
    render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
    expect(screen.getByTestId("tile-featured").dataset.imagePosition).toBe("above")
  })

  it("orders Featured first on mobile and between the two columns at md+", () => {
    const { container } = render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
    const [leftColumn, featuredColumn, rightColumn] = Array.from(
      container.querySelector("section")!.children,
    )

    expect(leftColumn!.className).toContain("order-2")
    expect(leftColumn!.className).toContain("md:order-none")
    expect(featuredColumn!.className).toContain("order-1")
    expect(featuredColumn!.className).toContain("md:order-none")
    expect(rightColumn!.className).toContain("order-3")
    expect(rightColumn!.className).toContain("md:order-none")

    // DOM order must stay left -> featured -> right so the md:order-none
    // reset lands Featured between the two columns, not just anywhere.
    expect(featuredColumn!.querySelector('[data-testid="tile-featured"]')).toBeTruthy()
  })

  it("matches snapshot with all 10 slots", () => {
    const { container } = render(<Gauss10Layout slots={makeSlots([...requiredIds, "h", "i"])} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
