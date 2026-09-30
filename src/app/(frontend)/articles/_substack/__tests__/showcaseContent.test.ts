// @vitest-environment node
import type * as SeedArticles from "@/endpoints/seed/articles"
import type * as SeedMedia from "@/endpoints/seed/media"
import type { Article, Media, User } from "@/payload-types"
import { beforeAll, describe, expect, it, vi } from "vitest"

// Capture each showcase article's content instead of saving it, so the test
// renders exactly what `pnpm showcase` pushes to a preview.
const captured = new Map<string, Record<string, unknown>>()
vi.mock("@/endpoints/seed/articles", async (importOriginal) => ({
  ...(await importOriginal<typeof SeedArticles>()),
  createArticle: vi.fn(async (_payload: unknown, options: Record<string, unknown>) => {
    captured.set(String(options.slug ?? options.title), options)
    return { id: captured.size, ...options }
  }),
}))

// The media-collage seed downloads images; tests stay offline.
vi.mock("@/endpoints/seed/media", async (importOriginal) => ({
  ...(await importOriginal<typeof SeedMedia>()),
  createMediaFromURL: vi.fn(async () => ({
    id: 99,
    url: "/api/media/file/downloaded.png",
    alt: "Downloaded",
    mimeType: "image/png",
  })),
}))

beforeAll(() => {
  process.env.SERVER_URL = "https://example.org"
})

const { showcaseEntries } = await import("@/endpoints/seed/showcase")
const { substackArticleHTML } = await import("../generateSubstackFeed")

// Anything else a seed helper asks Payload for (map assets, lookups) gets a stub doc.
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
const fakePayload = new Proxy(
  { logger },
  {
    get: (target, key) =>
      key in target
        ? target[key as keyof typeof target]
        : vi.fn(async (args: { data?: Record<string, unknown> } = {}) => ({
            id: 1,
            docs: [],
            totalDocs: 0,
            ...args.data,
          })),
  },
) as never

const writer = { id: 1, name: "Writer" } as User
const media = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  url: `/api/media/file/image-${i + 1}.png`,
  alt: `Image ${i + 1}`,
  mimeType: "image/png",
})) as Media[]

const rendered: { slug: string; html: string }[] = []

beforeAll(async () => {
  for (const entry of showcaseEntries) {
    captured.clear()
    await entry.create(fakePayload, [writer], media)
    for (const options of captured.values()) {
      const article = {
        id: 1,
        slug: entry.slug,
        _status: "published",
        publishedAt: "2026-09-01T12:00:00.000Z",
        ...options,
      } as Article
      rendered.push({ slug: entry.slug, html: substackArticleHTML(article) })
    }
  }
})

/**
 * The showcase catalog covers every block and formatting feature, so rendering
 * it catches markup Substack's editor would drop or garble: inline styles and
 * classes it strips, form elements from checklists, and "unknown node".
 */
describe("Substack HTML for the showcase articles", () => {
  it("renders every showcase entry", () => {
    expect(rendered.map(({ slug }) => slug)).toEqual(
      expect.arrayContaining(showcaseEntries.map(({ slug }) => slug)),
    )
  })

  it.each([
    ["inline styles", /\sstyle=/],
    ["class attributes", /\sclass=/],
    ["form elements", /<(input|label)\b/],
    ["React attribute names", /\s(htmlFor|readOnly|tabIndex)=/],
    ['"unknown node"', /unknown node/],
  ])("contains no %s", (_label, pattern) => {
    const offenders = rendered
      .filter(({ html }) => pattern.test(html))
      .map(
        ({ slug, html }) =>
          `${slug}: …${html.slice(Math.max(0, html.search(pattern) - 60), html.search(pattern) + 60)}…`,
      )
    expect(offenders).toEqual([])
  })
})
