import { cleanup, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { whipCountData } from "@/stories/fixtures/whipCount"

const { find, draft, isExperimentEnabled, generateMeta, whipCount, notFound } = vi.hoisted(() => ({
  find: vi.fn(),
  draft: { isEnabled: false },
  isExperimentEnabled: vi.fn(async () => true),
  generateMeta: vi.fn(async () => ({ title: "meta" })),
  whipCount: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

vi.mock("@/data/payload", () => ({ getPayloadClient: async () => ({ find }) }))
vi.mock("next/headers", () => ({ draftMode: async () => draft }))
vi.mock("next/navigation", () => ({ notFound }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({ isExperimentEnabled }))
vi.mock("@/utilities/generateMeta", () => ({ generateMeta }))
// Children with their own tests render as markers: these tests are about what the page decides.
vi.mock("@/components/Breadcrumbs", () => ({
  Breadcrumbs: ({ items }: { items: { name: string; path: string }[] }) => (
    <nav data-testid="crumbs">{items.map((item) => `${item.name}=${item.path}`).join("|")}</nav>
  ),
}))
vi.mock("@/components/LivePreviewListener", () => ({
  LivePreviewListener: () => <div data-testid="live-preview" />,
}))
vi.mock("@/interactives/whip-count/WhipCount", () => ({
  WhipCount: (props: unknown) => {
    whipCount(props)
    return <div data-testid="whip-count" />
  },
}))

// React's `cache` only dedupes inside a server render; here each call runs the query.
vi.mock("react", async () => ({
  ...(await vi.importActual<object>("react")),
  cache: <T,>(fn: T): T => fn,
}))

const { default: WhipCountPage, generateMetadata } = await import("../page")

const doc = {
  id: 1,
  slug: "leader",
  title: "Who will lead?",
  intro: "Two candidates, one vote.",
  methodology: "Public statements only.",
  data: JSON.parse(JSON.stringify(whipCountData)) as unknown,
}
const args = (slug?: string) => ({ params: Promise.resolve(slug === undefined ? {} : { slug }) })
const renderPage = async (slug = "leader") =>
  render((await WhipCountPage(args(slug))) as React.ReactElement)

describe("the whip count page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draft.isEnabled = false
    isExperimentEnabled.mockResolvedValue(true)
    find.mockResolvedValue({ docs: [doc] })
  })
  afterEach(cleanup)

  it("shows the title, standfirst, count and methodology", async () => {
    await renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Who will lead?" })).toBeInTheDocument()
    expect(screen.getByText("Two candidates, one vote.")).toBeInTheDocument()
    expect(screen.getByText("Public statements only.")).toBeInTheDocument()
    expect(screen.getByTestId("crumbs")).toHaveTextContent(
      "Interactives=/interactives|Who will lead?=/interactives/whip-counts/leader",
    )
    expect(whipCount).toHaveBeenCalledWith({
      title: "Who will lead?",
      data: whipCountData,
      storageKey: "leader",
    })
    expect(screen.queryByTestId("live-preview")).not.toBeInTheDocument()
  })

  it("asks for the published document as a reader, and the draft in preview", async () => {
    await renderPage()
    expect(find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "whip-counts",
        draft: false,
        overrideAccess: false,
        where: { slug: { equals: "leader" } },
      }),
    )
    cleanup()
    draft.isEnabled = true
    await renderPage()
    expect(find).toHaveBeenLastCalledWith(
      expect.objectContaining({ draft: true, overrideAccess: true }),
    )
    expect(screen.getByTestId("live-preview")).toBeInTheDocument()
  })

  it("is not found for an unknown slug, or while the experiment is off", async () => {
    find.mockResolvedValue({ docs: [] })
    await expect(renderPage("nope")).rejects.toThrow("NEXT_NOT_FOUND")
    find.mockResolvedValue({ docs: [doc] })
    isExperimentEnabled.mockResolvedValue(false)
    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND")
    expect(find).toHaveBeenCalledTimes(1)
  })

  it("says a count has no data yet, and tells a previewing editor why", async () => {
    find.mockResolvedValue({
      docs: [{ ...doc, intro: null, methodology: null, data: { schema: "x" } }],
    })
    await renderPage()
    expect(screen.getByText("This count has no data yet.")).toBeInTheDocument()
    expect(screen.queryByTestId("whip-count")).not.toBeInTheDocument()
    expect(screen.queryByText("How this is counted")).not.toBeInTheDocument()
    cleanup()
    draft.isEnabled = true
    await renderPage()
    expect(screen.getByText(/can't be read: "schema" must be/)).toBeInTheDocument()
  })

  it("builds its metadata from the title and standfirst", async () => {
    await expect(generateMetadata(args("leader"))).resolves.toEqual({ title: "meta" })
    expect(generateMeta).toHaveBeenLastCalledWith({
      doc: { meta: { title: "Who will lead?", description: "Two candidates, one vote." } },
      canonicalPath: "/interactives/whip-counts/leader",
    })
    find.mockResolvedValue({ docs: [] })
    await generateMetadata(args())
    expect(generateMeta).toHaveBeenLastCalledWith({
      doc: null,
      canonicalPath: "/interactives/whip-counts/",
    })
  })
})
