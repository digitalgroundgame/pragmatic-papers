import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { CollectionGridSlots } from "@/payload-types"
import { Gauss10, Gauss10Layout } from "../Gauss10"

vi.mock("../../CollectionTile", () => ({
  CollectionTile: ({
    tile,
    imagePosition,
    variant,
    priority,
    loading,
  }: {
    tile?: { id?: string | null }
    imagePosition?: string
    variant?: string
    priority?: boolean
    loading?: string
  }) =>
    tile ? (
      <div
        data-testid={`tile-${tile.id}`}
        data-image-position={imagePosition}
        data-variant={variant}
        data-priority={priority}
        data-loading={loading}
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
const allIds = [...requiredIds, "h", "i"]

/** The three top-level grid children, in DOM order: left | featured | right. */
function getColumns(container: HTMLElement) {
  const [left, featured, right] = Array.from(container.querySelector("section")!.children)
  return {
    left: left as HTMLElement,
    featured: featured as HTMLElement,
    right: right as HTMLElement,
  }
}

/** Slot ids rendered inside a column, in DOM order. */
function tileIdsIn(column: HTMLElement) {
  return Array.from(column.querySelectorAll("[data-testid^='tile-']")).map((el) =>
    el.getAttribute("data-testid")!.replace("tile-", ""),
  )
}

describe("Gauss10", () => {
  it("declares one description per slot, bounded by minSlots/maxSlots", () => {
    expect(Gauss10.slotDescriptions).toHaveLength(10)
    expect(Gauss10.minSlots).toBe(8)
    expect(Gauss10.maxSlots).toBe(10)
    expect(Gauss10.slotDescriptions).toHaveLength(Gauss10.maxSlots!)
    expect(Gauss10.label).toBe("Gauss 10")
  })
})

describe("Gauss10Layout", () => {
  describe("slot rendering", () => {
    it("renders the 8 required slots and omits H and I when absent", () => {
      render(<Gauss10Layout slots={makeSlots(requiredIds)} />)

      for (const id of requiredIds) {
        expect(screen.getByTestId(`tile-${id}`)).toBeTruthy()
      }
      expect(screen.queryByTestId("tile-h")).toBeNull()
      expect(screen.queryByTestId("tile-i")).toBeNull()
    })

    it("renders H but not I when only 9 slots are provided", () => {
      render(<Gauss10Layout slots={makeSlots([...requiredIds, "h"])} />)

      expect(screen.getByTestId("tile-h")).toBeTruthy()
      expect(screen.queryByTestId("tile-i")).toBeNull()
    })

    it("renders all 10 slots when provided", () => {
      render(<Gauss10Layout slots={makeSlots(allIds)} />)

      for (const id of allIds) {
        expect(screen.getByTestId(`tile-${id}`)).toBeTruthy()
      }
    })

    it("ignores slots beyond the 10th", () => {
      render(<Gauss10Layout slots={makeSlots([...allIds, "extra"])} />)

      expect(screen.queryByTestId("tile-extra")).toBeNull()
      expect(screen.getByTestId("tile-i")).toBeTruthy()
    })
  })

  describe("slot placement", () => {
    it("puts A, B, C in the left column and D, E, F in the right column", () => {
      const { container } = render(<Gauss10Layout slots={makeSlots(allIds)} />)
      const { left, right } = getColumns(container)

      expect(tileIdsIn(left)).toEqual(["a", "b", "c"])
      expect(tileIdsIn(right)).toEqual(["d", "e", "f"])
    })

    it("puts Featured above the G/H/I bottom row in the center column", () => {
      const { container } = render(<Gauss10Layout slots={makeSlots(allIds)} />)
      const { featured } = getColumns(container)

      expect(tileIdsIn(featured)).toEqual(["featured", "g", "h", "i"])
    })

    it("orders Featured first below lg and between the two columns at lg+", () => {
      const { container } = render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
      const { left, featured, right } = getColumns(container)

      expect(left.className).toContain("order-2")
      expect(left.className).toContain("lg:order-0")
      expect(featured.className).toContain("order-1")
      expect(featured.className).toContain("lg:order-0")
      expect(right.className).toContain("order-3")
      expect(right.className).toContain("lg:order-0")

      // DOM order must stay left -> featured -> right so the lg:order-0
      // reset lands Featured between the two columns, not just anywhere.
      expect(featured.querySelector('[data-testid="tile-featured"]')).toBeTruthy()
    })

    it("stacks the side columns into 3 across at md, then 1 across at lg", () => {
      const { container } = render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
      const { left, right } = getColumns(container)

      for (const column of [left, right]) {
        expect(column.className).toContain("grid-cols-1")
        expect(column.className).toContain("md:col-span-3")
        expect(column.className).toContain("md:grid-cols-3")
        expect(column.className).toContain("lg:col-span-1")
        expect(column.className).toContain("lg:grid-cols-1")
      }
    })
  })

  describe("image position", () => {
    it("marks the featured slot with 'above' image position", () => {
      render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
      expect(screen.getByTestId("tile-featured").dataset.imagePosition).toBe("above")
    })

    it("gives the compact column slots C and F no image", () => {
      render(<Gauss10Layout slots={makeSlots(requiredIds)} />)

      expect(screen.getByTestId("tile-c").dataset.imagePosition).toBe("none")
      expect(screen.getByTestId("tile-f").dataset.imagePosition).toBe("none")
    })

    it("gives G the 'left' image position when H and I are both absent", () => {
      render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
      expect(screen.getByTestId("tile-g").dataset.imagePosition).toBe("left")
    })

    it("switches G to 'above' as soon as H is present", () => {
      render(<Gauss10Layout slots={makeSlots([...requiredIds, "h"])} />)

      expect(screen.getByTestId("tile-g").dataset.imagePosition).toBe("above")
      expect(screen.getByTestId("tile-h").dataset.imagePosition).toBe("above")
    })

    it("renders H and I with 'above' image position when all 10 slots are provided", () => {
      render(<Gauss10Layout slots={makeSlots(allIds)} />)

      expect(screen.getByTestId("tile-h").dataset.imagePosition).toBe("above")
      expect(screen.getByTestId("tile-i").dataset.imagePosition).toBe("above")
      expect(screen.getByTestId("tile-g").dataset.imagePosition).toBe("above")
    })
  })

  describe("image loading", () => {
    it("marks only the featured slot as priority", () => {
      render(<Gauss10Layout slots={makeSlots(allIds)} priority />)

      expect(screen.getByTestId("tile-featured").dataset.priority).toBe("true")
      for (const id of allIds.filter((slotId) => slotId !== "featured")) {
        expect(screen.getByTestId(`tile-${id}`).dataset.priority).toBeUndefined()
      }
    })

    it("leaves priority unset when the prop is not passed", () => {
      render(<Gauss10Layout slots={makeSlots(requiredIds)} />)
      expect(screen.getByTestId("tile-featured").dataset.priority).toBeUndefined()
    })

    it("forwards loading to every image-bearing slot except Featured", () => {
      render(<Gauss10Layout slots={makeSlots(allIds)} loading="lazy" />)

      for (const id of ["a", "b", "d", "e", "g", "h", "i"]) {
        expect(screen.getByTestId(`tile-${id}`).dataset.loading).toBe("lazy")
      }

      // Featured opts into `priority` instead; the two are mutually exclusive.
      expect(screen.getByTestId("tile-featured").dataset.loading).toBeUndefined()
    })

    it("leaves loading unset on every slot when the prop is not passed", () => {
      render(<Gauss10Layout slots={makeSlots(allIds)} />)

      for (const id of allIds) {
        expect(screen.getByTestId(`tile-${id}`).dataset.loading).toBeUndefined()
      }
    })

    it("does not set loading on the imageless slots C and F", () => {
      render(<Gauss10Layout slots={makeSlots(allIds)} loading="lazy" />)

      expect(screen.getByTestId("tile-c").dataset.loading).toBeUndefined()
      expect(screen.getByTestId("tile-f").dataset.loading).toBeUndefined()
    })
  })

  describe("variants", () => {
    it("renders the image-bearing slots at the 'medium' variant", () => {
      render(<Gauss10Layout slots={makeSlots(allIds)} />)

      for (const id of ["featured", "a", "b", "d", "e", "g", "h", "i"]) {
        expect(screen.getByTestId(`tile-${id}`).dataset.variant).toBe("medium")
      }
    })
  })

  describe("section props", () => {
    it("merges className onto the grid without dropping the base classes", () => {
      const { container } = render(
        <Gauss10Layout slots={makeSlots(requiredIds)} className="mt-12" />,
      )
      const section = container.querySelector("section")!

      expect(section.className).toContain("mt-12")
      expect(section.className).toContain("grid")
      expect(section.className).toContain("lg:grid-cols-5")
    })

    it("spreads remaining props onto the section element", () => {
      const { container } = render(
        <Gauss10Layout slots={makeSlots(requiredIds)} id="gauss" aria-label="Featured stories" />,
      )
      const section = container.querySelector("section")!

      expect(section.id).toBe("gauss")
      expect(section.getAttribute("aria-label")).toBe("Featured stories")
    })
  })

  it("matches snapshot with all 10 slots", () => {
    const { container } = render(<Gauss10Layout slots={makeSlots(allIds)} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
