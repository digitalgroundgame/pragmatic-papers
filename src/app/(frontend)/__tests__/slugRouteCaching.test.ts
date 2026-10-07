import { beforeEach, describe, expect, it, vi } from "vitest"

const { find } = vi.hoisted(() => ({ find: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@payload-config", () => ({ default: {} }))
vi.mock("payload", () => ({ getPayload: async () => ({ find }) }))
vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => ({ find }) }))

const routes = {
  articles: () => import("../articles/[slug]/page"),
  volumes: () => import("../volumes/[slug]/page"),
  pages: () => import("../[slug]/page"),
  authors: () => import("../authors/[slug]/page"),
  topics: () => import("../topics/[slug]/page"),
  interactives: () => import("../interactives/[slug]/page"),
}

beforeEach(() => {
  find.mockReset()
})

describe.each(["articles", "volumes"] as const)("/%s/[slug]", (route) => {
  it("is prerendered and revalidated, never forced per request", async () => {
    const page = await routes[route]()
    expect(page).not.toHaveProperty("dynamic")
    expect(page).toHaveProperty("revalidate", 3600)
    expect(page.generateStaticParams).toBeTypeOf("function")
  })

  it("prebuilds only published documents readers can see", async () => {
    find.mockResolvedValue({ docs: [{ slug: "first" }, { slug: "second" }] })
    const { generateStaticParams } = await routes[route]()

    await expect(generateStaticParams()).resolves.toEqual([{ slug: "first" }, { slug: "second" }])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: route, draft: false, overrideAccess: false }),
    )
  })

  it("builds against an empty database, leaving every slug to its first request", async () => {
    find.mockResolvedValue({ docs: [] })
    const { generateStaticParams } = await routes[route]()
    await expect(generateStaticParams()).resolves.toEqual([])
  })
})

describe.each(["pages", "authors", "topics"] as const)("the %s route", (route) => {
  // Paginated with ?p=, which only a request carries.
  it("is rendered per request and prebuilds nothing", async () => {
    const page = await routes[route]()
    expect(page).toHaveProperty("dynamic", "force-dynamic")
    expect(page).not.toHaveProperty("generateStaticParams")
  })
})

describe("/interactives/[slug]", () => {
  it("is rendered per request and prebuilds nothing", async () => {
    const page = await routes.interactives()
    expect(page).toHaveProperty("dynamic", "force-dynamic")
    expect(page).not.toHaveProperty("generateStaticParams")
  })
})
