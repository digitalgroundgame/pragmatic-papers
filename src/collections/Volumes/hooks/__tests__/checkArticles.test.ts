// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

const find = vi.fn()

vi.mock("payload", () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock("@payload-config", () => ({ default: Promise.resolve({}) }))

const { checkArticles } = await import("../checkArticles")

const check = (value: number[] | null | undefined) => checkArticles(value as never, {} as never)

afterEach(() => {
  vi.clearAllMocks()
})

describe("checkArticles", () => {
  it("passes an empty selection without querying", async () => {
    await expect(check([])).resolves.toBe(true)
    await expect(check(null)).resolves.toBe(true)
    expect(find).not.toHaveBeenCalled()
  })

  it("passes when every selected article is published", async () => {
    find.mockResolvedValue({
      docs: [
        { title: "A", _status: "published" },
        { title: "B", _status: "published" },
      ],
    })

    await expect(check([1, 2])).resolves.toBe(true)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        where: { id: { in: [1, 2] } },
        draft: true,
        overrideAccess: true,
      }),
    )
  })

  it("names every unpublished article", async () => {
    find.mockResolvedValue({
      docs: [
        { title: "Live", _status: "published" },
        { title: "Draft one", _status: "draft" },
        { title: "Draft two", _status: "draft" },
      ],
    })

    await expect(check([1, 2, 3])).resolves.toBe(
      "The following articles are not published: Draft one, Draft two",
    )
  })
})
