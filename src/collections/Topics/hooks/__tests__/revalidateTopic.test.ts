// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateForReaders } = vi.hoisted(() => ({ revalidateForReaders: vi.fn() }))
vi.mock("@/hooks/revalidateForReaders", () => ({ revalidateForReaders }))

const { rememberTopicArticles, revalidateTopicChange, revalidateTopicDelete } =
  await import("../revalidateTopic")

const find = vi.fn()
const logger = { info: vi.fn() }
const req = (context: Record<string, unknown> = {}) => ({ payload: { find, logger }, context })

beforeEach(() => {
  vi.clearAllMocks()
  find.mockResolvedValue({ docs: [{ slug: "a" }, { slug: "b" }] })
})

describe("revalidateTopicChange", () => {
  it("revalidates the topic's published articles and purges its page and the listings", async () => {
    await revalidateTopicChange({
      doc: { id: 4, slug: "economy" },
      previousDoc: { id: 4, slug: "economy" },
      operation: "update",
      req: req(),
    } as never)

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "articles",
        where: { topics: { equals: 4 }, _status: { equals: "published" } },
      }),
    )
    expect(revalidateForReaders).toHaveBeenCalledExactlyOnceWith(logger, "topic economy", {
      paths: ["/articles/a", "/articles/b"],
      purgeOnly: ["/topics/economy"],
      shared: true,
    })
  })

  it("purges the old URL too when the slug changes", async () => {
    await revalidateTopicChange({
      doc: { id: 4, slug: "econ" },
      previousDoc: { id: 4, slug: "economy" },
      operation: "update",
      req: req(),
    } as never)

    expect(revalidateForReaders).toHaveBeenCalledWith(
      logger,
      "topic econ",
      expect.objectContaining({ purgeOnly: ["/topics/econ", "/topics/economy"] }),
    )
  })

  it("only purges the listings for a new topic, which no article is filed under yet", async () => {
    await revalidateTopicChange({
      doc: { id: 5, slug: "new" },
      operation: "create",
      req: req(),
    } as never)

    expect(find).not.toHaveBeenCalled()
    expect(revalidateForReaders).toHaveBeenCalledExactlyOnceWith(logger, "topic new created", {
      shared: true,
    })
  })

  it("does nothing when revalidation is disabled", async () => {
    await revalidateTopicChange({
      doc: { id: 4, slug: "economy" },
      operation: "update",
      req: req({ disableRevalidate: true }),
    } as never)
    expect(revalidateForReaders).not.toHaveBeenCalled()
  })
})

describe("deleting a topic", () => {
  it("revalidates the articles it was filed under, found before it went", async () => {
    const shared = req()
    await rememberTopicArticles({ id: 4, req: shared } as never)
    find.mockResolvedValue({ docs: [] })
    await revalidateTopicDelete({ doc: { id: 4, slug: "economy" }, id: 4, req: shared } as never)

    expect(revalidateForReaders).toHaveBeenCalledExactlyOnceWith(logger, "topic economy deleted", {
      paths: ["/articles/a", "/articles/b"],
      purgeOnly: ["/topics/economy"],
      shared: true,
    })
  })
})
