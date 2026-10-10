import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { authors } from "@/stories/fixtures/docs"

const { find } = vi.hoisted(() => ({ find: vi.fn() }))

vi.mock("@/data/payload", () => ({ getPayloadClient: async () => ({ find }) }))

const { ContributorsBlock } = await import("../Component")

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const renderBlock = async (people: number[]) =>
  render(
    <>{await ContributorsBlock({ blockType: "contributors", title: "Contributors", people })}</>,
  )

describe("ContributorsBlock", () => {
  it("looks people up as a reader would, so nobody links to an author page that 404s", async () => {
    find.mockResolvedValue({ docs: [authors[0]] })

    await renderBlock([authors[0]!.id, 99])

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        overrideAccess: false,
        where: { id: { in: [authors[0]!.id, 99] } },
      }),
    )
    expect(screen.getByRole("link", { name: authors[0]!.name! })).toHaveAttribute(
      "href",
      `/contributors/${authors[0]!.slug}`,
    )
  })

  it("renders nothing when readers can open none of them", async () => {
    find.mockResolvedValue({ docs: [] })

    const { container } = await renderBlock([99])

    expect(container).toBeEmptyDOMElement()
  })
})
