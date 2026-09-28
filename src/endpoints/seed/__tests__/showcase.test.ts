import type { Media, User } from "@/payload-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { showcaseEntries } from "../showcase"

const writer = { id: 1, roles: ["writer"] } as User
const media = [1, 2, 3, 4].map((id) => ({ id }) as Media)

interface CreateArgs {
  collection: string
  data: { slug?: string }
}

// Seeds that download their own images (the media collage) get a stand-in.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } }),
    ),
  )
  return () => vi.unstubAllGlobals()
})

describe("showcaseEntries", () => {
  it("registers each slug once", () => {
    const slugs = showcaseEntries.map((entry) => entry.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  // `pnpm showcase` skips an entry whose slug is already on the target, so a
  // slug that drifts from the one its seed creates would be pushed every run.
  it.each(showcaseEntries.map((entry) => [entry.slug, entry] as const))(
    "%s creates an article with that slug, using only create and logger",
    async (slug, entry) => {
      let nextId = 100
      const create = vi.fn(async (_args: CreateArgs) => ({ id: nextId++ }))
      const payload = { create, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as never

      await entry.create(payload, [writer], media)

      const articles = create.mock.calls
        .map(([args]) => args)
        .filter((args) => args.collection === "articles")
      expect(articles.map((args) => args.data.slug)).toEqual([slug])
    },
  )
})
