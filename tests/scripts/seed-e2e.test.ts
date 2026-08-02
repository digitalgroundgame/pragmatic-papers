import { beforeEach, describe, expect, it, vi } from "vitest"

const mockDestroy = vi.fn()
const mockCreate = vi.fn()
const mockUpdateGlobal = vi.fn()
const mockPayload = {
  create: mockCreate,
  updateGlobal: mockUpdateGlobal,
  db: { destroy: mockDestroy },
}

const mockWriter = { id: 1, email: "writer@e2e.test", name: "E2E Writer" }
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

vi.mock("@/endpoints/seed/features/interactive-maps", () => ({
  createMoCongressionalMapsArticle: vi.fn().mockResolvedValue(mockMapArticleId),
}))

const { createUser } = await import("@/endpoints/seed/users")
const { createRichTextShowcaseArticle } =
  await import("@/endpoints/seed/features/rich-text-showcase")
const { createMoCongressionalMapsArticle } =
  await import("@/endpoints/seed/features/interactive-maps")
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
        name: "E2E Writer",
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
})
