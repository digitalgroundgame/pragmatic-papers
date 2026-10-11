// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { find, queryUserBySlug, permanentRedirect } = vi.hoisted(() => ({
  find: vi.fn(),
  queryUserBySlug: vi.fn(),
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => ({ find }) }))
vi.mock("@/utilities/queries", () => ({ queryUserBySlug, queryVolumesForArticles: vi.fn() }))
vi.mock("@/components/PayloadRedirects", () => ({ PayloadRedirects: () => null }))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("next/headers", () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock("next/navigation", () => ({ notFound: vi.fn(), permanentRedirect }))

import AuthorPage from "../page"

const render = (slug: string) =>
  AuthorPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })

beforeEach(() => {
  vi.clearAllMocks()
  queryUserBySlug.mockResolvedValue(null)
})

describe("/contributors/<id>", () => {
  it("sends an old id URL to the author's page", async () => {
    find.mockResolvedValue({ docs: [{ id: 8, slug: "jane-doe" }] })
    await expect(render("8")).rejects.toThrow("NEXT_REDIRECT /contributors/jane-doe")
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        overrideAccess: false,
        where: { id: { equals: 8 } },
      }),
    )
  })

  it("falls through to redirects and 404 for an id nobody public has", async () => {
    find.mockResolvedValue({ docs: [] })
    await render("27")
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it("doesn't look up slugs that aren't numbers", async () => {
    await render("undefined")
    expect(find).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })
})
