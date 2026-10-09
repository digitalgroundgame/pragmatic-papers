// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { find } = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock("@/utilities/getPayloadConfig", () => ({ getPayloadConfig: async () => ({ find }) }))

import sitemap from "../sitemap"

const SITE_URL = "https://pragmaticpapers.com"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SERVER_URL", `${SITE_URL}/`)
})
afterEach(() => vi.unstubAllEnvs())

describe("/authors/sitemap.xml", () => {
  it("lists the authors /authors lists", async () => {
    find.mockResolvedValue({ docs: [] })
    await sitemap()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        where: {
          or: [
            { roles: { in: expect.arrayContaining(["writer"]) } },
            { publicProfile: { equals: true } },
          ],
        },
        select: { slug: true, updatedAt: true },
      }),
    )
  })

  it("links /authors, as fresh as its newest author, and every author with a slug", async () => {
    find.mockResolvedValue({
      docs: [
        { slug: "ada", updatedAt: "2026-10-02T00:00:00.000Z" },
        { slug: null, updatedAt: "2026-10-05T00:00:00.000Z" },
        { slug: "grace", updatedAt: "2026-10-08T00:00:00.000Z" },
      ],
    })
    expect(await sitemap()).toEqual([
      { url: `${SITE_URL}/authors`, lastModified: "2026-10-08T00:00:00.000Z" },
      { url: `${SITE_URL}/authors/ada`, lastModified: "2026-10-02T00:00:00.000Z" },
      { url: `${SITE_URL}/authors/grace`, lastModified: "2026-10-08T00:00:00.000Z" },
    ])
  })

  it("is empty when there are no authors", async () => {
    find.mockResolvedValue({ docs: [] })
    expect(await sitemap()).toEqual([])
  })
})
