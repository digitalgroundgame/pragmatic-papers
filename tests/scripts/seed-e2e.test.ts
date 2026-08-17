import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDestroy = vi.fn()
const mockCreate = vi.fn()
const mockUpdateGlobal = vi.fn()
const mockPayload = {
  create: mockCreate,
  updateGlobal: mockUpdateGlobal,
  db: { destroy: mockDestroy },
}

const mockWriter = { id: 1, email: "writer@e2e.test", name: "Teagan Wordsmith" }
const mockArticleId = 42
const mockMapArticleId = 43
const mockVolume = { id: 99, title: "E2E Test Volume" }

vi.mock("payload", () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock("@payload-config", () => ({ default: {} }))

vi.mock("@/endpoints/seed/users", () => ({
  createUser: vi.fn().mockResolvedValue(mockWriter),
}))

vi.mock("@/endpoints/seed/features/rich-text-showcase", () => ({
  createRichTextShowcaseArticle: vi.fn().mockResolvedValue(mockArticleId),
}))

// Stubbed like the other seed collaborators. It also keeps `payload.create`
// reserved for the calls this script makes directly, which the error-path test
// below depends on to know which create it is rejecting.
vi.mock("@/endpoints/seed/articles", () => ({
  createArticle: vi.fn().mockResolvedValue({ id: 44 }),
}))

vi.mock("@/endpoints/seed/features/interactive-maps", () => ({
  createMoCongressionalMapsArticle: vi.fn().mockResolvedValue(mockMapArticleId),
}))

// Merch products are seeded into their own collection before the home page
// that queries them. Stubbed like the other seed collaborators above; the
// helper itself is covered by tests/integration/syncShopifyProducts.test.ts.
vi.mock("@/endpoints/seed/merch", () => ({
  seedMerchProducts: vi.fn().mockResolvedValue([1, 2, 3, 4, 5, 6]),
}))

const { createUser } = await import("@/endpoints/seed/users")
const { createArticle } = await import("@/endpoints/seed/articles")
const { createRichTextShowcaseArticle } =
  await import("@/endpoints/seed/features/rich-text-showcase")
const { createMoCongressionalMapsArticle } =
  await import("@/endpoints/seed/features/interactive-maps")
const { seedMerchProducts } = await import("@/endpoints/seed/merch")
const { main } = await import("../../scripts/seed-e2e")

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(mockVolume)
})

describe("seed-e2e main()", () => {
  it("creates the e2e writer with correct data and disableRevalidate context", async () => {
    await main()

    expect(createUser).toHaveBeenCalledWith(
      mockPayload,
      {
        email: "writer@e2e.test",
        password: "e2e-test-password-123",
        name: "Teagan Wordsmith",
        affiliation: "Senior Research Fellow, Pragmatic Papers Institute",
        biography: expect.any(Object),
        roles: ["writer"],
        slug: "e2e-writer",
        socials: [
          { link: { type: "custom", label: "X", url: "https://x.com/e2ewriter", newTab: true } },
          {
            link: {
              type: "custom",
              label: "YouTube",
              url: "https://youtube.com/@e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Twitch",
              url: "https://twitch.tv/e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Instagram",
              url: "https://instagram.com/e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "Discord",
              url: "https://discord.gg/e2ewriter",
              newTab: true,
            },
          },
          {
            link: {
              type: "custom",
              label: "GitHub",
              url: "https://github.com/e2ewriter",
              newTab: true,
            },
          },
        ],
      },
      "e2e writer",
      { disableRevalidate: true },
    )
  })

  it("creates the rich-text showcase article with the writer and empty media/topics", async () => {
    await main()

    expect(createRichTextShowcaseArticle).toHaveBeenCalledWith(
      mockPayload,
      [mockWriter],
      [],
      [],
      { disableRevalidate: true },
      "2026-06-04T00:00:00.000Z",
    )
  })

  it("creates the interactive map article with the writer and empty media", async () => {
    await main()

    expect(createMoCongressionalMapsArticle).toHaveBeenCalledWith(
      mockPayload,
      [mockWriter],
      [],
      [],
      {
        disableRevalidate: true,
      },
      "2026-06-04T00:00:00.000Z",
    )
  })

  it("creates three co-authors for the crowded byline", async () => {
    await main()

    for (const [name, slug, email] of [
      ["Sienna Scribe", "e2e-co-author-sienna", "sienna@e2e.test"],
      ["Marcus Ledger", "e2e-co-author-marcus", "marcus@e2e.test"],
      ["Alexandra Quill", "e2e-co-author-alexandra", "alexandra@e2e.test"],
    ]) {
      expect(createUser).toHaveBeenCalledWith(
        mockPayload,
        expect.objectContaining({ name, slug, email, roles: ["writer"] }),
        `e2e co-author ${name}`,
        { disableRevalidate: true },
      )
    }
  })

  it("creates a four-author article so the byline has a collapsed state", async () => {
    await main()

    expect(createArticle).toHaveBeenCalledWith(
      mockPayload,
      expect.objectContaining({
        slug: "committee-work-notes-from-a-crowded-byline",
        publishedAt: "2026-06-04T00:00:00.000Z",
      }),
      { disableRevalidate: true },
    )

    // createUser is stubbed to one writer, so every author resolves to the same
    // id — four of them is the point, not which four.
    const [, options] = vi.mocked(createArticle).mock.calls[0]!
    expect(options.authors).toHaveLength(4)
  })

  it("keeps the crowded-byline article off the homepage grid", async () => {
    await main()

    // gotoFirstArticle follows the first article link on the homepage and
    // example.spec.ts screenshots the whole page, so a third tile here would
    // shift unrelated baselines.
    const pageCall = mockCreate.mock.calls.find(([args]) => args.collection === "pages")?.[0]
    const grid = pageCall.data.layout.find(
      (block: { blockType: string }) => block.blockType === "collectionGrid",
    )
    expect(grid.slots).toHaveLength(2)
  })

  it("creates a volume with the article linked and slug '1'", async () => {
    await main()

    const volumeCall = mockCreate.mock.calls.find(([args]) => args.collection === "volumes")?.[0]
    expect(volumeCall).toBeDefined()
    expect(volumeCall.data).toMatchObject({
      title: "E2E Test Volume",
      volumeNumber: 1,
      slug: "1",
      _status: "published",
      articles: [mockArticleId],
      publishedAt: "2026-06-04T00:00:00.000Z",
    })
    expect(volumeCall.context).toEqual({ disableRevalidate: true })
  })

  it("creates the homepage with a collectionGrid block referencing the article and volume", async () => {
    await main()

    const pageCall = mockCreate.mock.calls.find(([args]) => args.collection === "pages")?.[0]
    expect(pageCall).toBeDefined()
    expect(pageCall.data).toMatchObject({
      title: "Home",
      slug: "home",
      _status: "published",
      hero: { type: "none" },
    })
    expect(pageCall.data.layout[0]).toMatchObject({
      blockType: "collectionGrid",
      layout: "euler-2",
      slots: expect.arrayContaining([
        expect.objectContaining({
          collection: { relationTo: "articles", value: mockArticleId },
        }),
        expect.objectContaining({
          collection: { relationTo: "volumes", value: mockVolume.id },
        }),
      ]),
    })
    expect(pageCall.context).toEqual({ disableRevalidate: true })
  })

  it("always destroys the db connection, even if an error is thrown", async () => {
    mockCreate.mockRejectedValueOnce(new Error("db error"))

    await expect(main()).rejects.toThrow("db error")

    expect(mockDestroy).toHaveBeenCalledOnce()
  })

  it("seeds the footer global with disableRevalidate context", async () => {
    await main()

    expect(mockUpdateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "footer",
        context: { disableRevalidate: true },
      }),
    )
  })

  it("destroys the db connection after a successful run", async () => {
    await main()

    expect(mockDestroy).toHaveBeenCalledOnce()
  })

  it("seeds the merch catalogue the home carousel queries, sold-out product included", async () => {
    await main()

    expect(seedMerchProducts).toHaveBeenCalledOnce()
    const [, products] = vi.mocked(seedMerchProducts).mock.calls[0]!
    // merch.spec.ts asserts six products and one "Sold Out" badge.
    expect(products).toHaveLength(6)
    expect(products.filter((product) => product.availableForSale === false)).toHaveLength(1)
    expect(products[0]).toMatchObject({
      title: "Acid Washed Liberalism Charity Tee, Black",
      price: "100.00",
    })
  })
})
