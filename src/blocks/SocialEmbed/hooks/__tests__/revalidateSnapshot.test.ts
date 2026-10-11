import { beforeEach, describe, expect, it, vi } from "vitest"

const { buildSnapshot, findByID, update } = vi.hoisted(() => ({
  buildSnapshot: vi.fn(),
  findByID: vi.fn(),
  update: vi.fn(),
}))

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock("@/blocks/SocialEmbed/helpers/buildSnapshot", () => ({ buildSnapshot }))
vi.mock("@/data/payload", () => ({ getPayloadClient: async () => ({ findByID, update }) }))

import { revalidateSnapshot } from "../revalidateSnapshot"

const embed = (id: string, snapshot: Record<string, unknown> = {}) => ({
  type: "block",
  version: 2,
  fields: { id, blockType: "socialEmbed", url: `https://x.com/a/status/${id}`, snapshot },
})

const content = (...children: unknown[]) => ({
  root: { type: "root", version: 1, children },
})

const args = {
  parentDoc: { collection: "articles" as const, id: 12 },
  embedBlockId: "embed-b",
  platform: "twitter" as const,
  url: "https://x.com/a/status/embed-b",
  snapshot: { authorName: "Old name", html: "<p>old</p>" },
}

describe("revalidateSnapshot", () => {
  beforeEach(() => {
    buildSnapshot.mockReset().mockResolvedValue({ html: "<p>new</p>", fetchedAt: "2026-10-11" })
    findByID.mockReset()
    update.mockReset()
  })

  it("writes the refreshed snapshot into the matching block and leaves the others alone", async () => {
    const other = embed("embed-a", { html: "<p>a</p>" })
    // The matching block sits inside a nested node, as it would in a list or quote.
    const nested = { type: "quote", version: 1, children: [embed("embed-b", args.snapshot)] }
    findByID.mockResolvedValue({ id: 12, content: content(other, nested) })

    const snapshot = await revalidateSnapshot(args)

    const merged = { authorName: "Old name", html: "<p>new</p>", fetchedAt: "2026-10-11" }
    expect(snapshot).toEqual(merged)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "articles", id: 12, depth: 0 }),
    )
    expect(update).toHaveBeenCalledTimes(1)
    const { data, context } = update.mock.calls[0]![0]
    expect(context).toEqual({ disableRevalidate: true })
    const [savedOther, savedNested] = data.content.root.children
    expect(savedOther).toBe(other)
    expect(savedNested.children[0].fields).toEqual({ ...embed("embed-b").fields, snapshot: merged })
  })

  it("returns the refreshed snapshot without saving when the block is gone", async () => {
    findByID.mockResolvedValue({ id: 12, content: content(embed("embed-a")) })

    expect(await revalidateSnapshot(args)).toMatchObject({ html: "<p>new</p>" })
    expect(update).not.toHaveBeenCalled()
  })

  it("ignores Lexical's parent back-references while walking the tree", async () => {
    const block = embed("embed-b")
    const root = content(block)
    Object.assign(block, { parent: root.root })
    findByID.mockResolvedValue({ id: 12, content: root })

    await revalidateSnapshot(args)

    expect(update).toHaveBeenCalledTimes(1)
  })
})
