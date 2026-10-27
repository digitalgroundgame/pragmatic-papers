import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Redirect } from "@/payload-types"

const mockGetRedirects = vi.fn<() => Promise<Redirect[]>>()
const mockPermanentRedirect = vi.fn((url: string) => {
  throw new Error(`permanentRedirect:${url}`)
})
const mockNotFound = vi.fn(() => {
  throw new Error("notFound")
})

vi.mock("../getRedirects", () => ({ getRedirects: mockGetRedirects }))
vi.mock("next/navigation", () => ({
  permanentRedirect: mockPermanentRedirect,
  notFound: mockNotFound,
}))

const { PayloadRedirects } = await import("..")

const redirect = (from: string, to: Redirect["to"]) => ({ id: 1, from, to }) as Redirect

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PayloadRedirects", () => {
  it("redirects permanently to a custom URL", async () => {
    mockGetRedirects.mockResolvedValue([
      redirect("/articles/old", { type: "custom", url: "https://example.com/new" }),
    ])
    await expect(PayloadRedirects({ url: "/articles/old" })).rejects.toThrow(
      "permanentRedirect:https://example.com/new",
    )
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it("redirects permanently to the document a redirect links to", async () => {
    mockGetRedirects.mockResolvedValue([
      redirect("/old-page", {
        type: "reference",
        reference: { relationTo: "articles", value: { id: 2, slug: "new-slug" } as never },
      }),
    ])
    await expect(PayloadRedirects({ url: "/old-page" })).rejects.toThrow(
      "permanentRedirect:/articles/new-slug",
    )
  })

  it("shows not found when no redirect matches", async () => {
    mockGetRedirects.mockResolvedValue([
      redirect("/elsewhere", { type: "custom", url: "/somewhere" }),
    ])
    await expect(PayloadRedirects({ url: "/articles/missing" })).rejects.toThrow("notFound")
    expect(mockPermanentRedirect).not.toHaveBeenCalled()
  })

  it("renders nothing for a page that exists and has no redirect", async () => {
    mockGetRedirects.mockResolvedValue([])
    await expect(PayloadRedirects({ disableNotFound: true, url: "/about" })).resolves.toBeNull()
  })
})
