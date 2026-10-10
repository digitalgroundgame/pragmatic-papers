import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queries, draft, experiment } = vi.hoisted(() => ({
  queries: { queryDocBySlug: vi.fn(), queryPublishedDocs: vi.fn() },
  draft: { isEnabled: false },
  experiment: { enabled: true },
}))

vi.mock("server-only", () => ({}))
vi.mock("@/plugins/docs/queries", () => queries)
vi.mock("next/headers", () => ({ draftMode: async () => draft }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async () => experiment.enabled,
}))
vi.mock("@/components/PayloadRedirects", () => ({
  PayloadRedirects: ({ url }: { url: string }) => <div data-testid="redirects" data-url={url} />,
}))
vi.mock("@/components/LivePreviewListener", () => ({
  LivePreviewListener: () => <div data-testid="live-preview" />,
}))

import DocPage, { generateMetadata } from "../page"

const heading = (text: string) => ({
  type: "heading",
  tag: "h2",
  version: 1,
  children: [{ type: "text", text, version: 1 }],
})
const paragraph = (text: string) => ({
  type: "paragraph",
  version: 1,
  children: [{ type: "text", text, version: 1 }],
})

const doc = {
  id: 1,
  slug: "experiments",
  title: "Switch beta features on",
  summary: "Experiments, per site.",
  publishedAt: "2026-10-18T00:00:00.000Z",
  showTableOfContents: true,
  content: {
    root: {
      type: "root",
      version: 1,
      children: [paragraph("Some features arrive off."), heading("Where the switches are")],
    },
  },
}

const args = (slug = "experiments") => ({ params: Promise.resolve({ slug }) })
const renderPage = async (slug?: string) =>
  render((await DocPage(args(slug))) as React.ReactElement)

beforeEach(() => {
  vi.clearAllMocks()
  draft.isEnabled = false
  experiment.enabled = true
  queries.queryDocBySlug.mockResolvedValue(doc)
  queries.queryPublishedDocs.mockResolvedValue([{ ...doc, section: "site" }])
})
afterEach(cleanup)

describe("DocPage", () => {
  it("hands an unknown slug to the redirects", async () => {
    queries.queryDocBySlug.mockResolvedValue(null)
    await renderPage("nope")
    expect(screen.getByTestId("redirects")).toHaveAttribute("data-url", "/docs/nope")
  })

  it("renders the doc with its date, breadcrumbs and share buttons", async () => {
    await renderPage()
    expect(
      screen.getByRole("heading", { level: 1, name: "Switch beta features on" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Some features arrive off.")).toBeInTheDocument()
    expect(screen.getByText("October 18, 2026")).toHaveAttribute("datetime", "2026-10-18")
    const trail = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(trail).toHaveClass("max-w-7xl")
    expect(trail).toHaveTextContent("Docs")
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    // Signed off with the squiggle, as articles are.
    expect(document.querySelector("[class*='squiggle.svg']")).toBeInTheDocument()
    expect(screen.queryByTestId("live-preview")).not.toBeInTheDocument()
  })

  it("marks the doc as the current page in the docs sidebar", async () => {
    await renderPage()
    const nav = screen.getByRole("navigation", { name: "Docs" })
    expect(within(nav).getByRole("link", { name: "Switch beta features on" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(within(nav).getByRole("link", { name: "All docs" })).not.toHaveAttribute("aria-current")
  })

  it("shows a table of contents linking to the doc's headings", async () => {
    await renderPage()
    expect(screen.getByRole("button", { name: /contents/i })).toBeInTheDocument()
    const sidebar = screen.getByRole("complementary")
    const link = within(sidebar).getByRole("link", { name: "Where the switches are" })
    const anchor = link.getAttribute("href")!.slice(1)
    expect(
      screen.getByRole("heading", { level: 2, name: "Where the switches are" }),
    ).toHaveAttribute("id", anchor)
  })

  it.each([
    ["the doc turns it off", { ...doc, showTableOfContents: false }, true],
    ["the experiment is off", doc, false],
  ])("has no table of contents when %s", async (_, value, enabled) => {
    queries.queryDocBySlug.mockResolvedValue(value)
    experiment.enabled = enabled
    await renderPage()
    expect(screen.queryByRole("button", { name: /contents/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
  })

  it("listens for live preview in draft mode", async () => {
    draft.isEnabled = true
    await renderPage()
    expect(screen.getByTestId("live-preview")).toBeInTheDocument()
  })
})

describe("generateMetadata", () => {
  it("uses the doc's title, summary and canonical URL", async () => {
    const meta = await generateMetadata(args())
    expect(meta.title).toBe("Switch beta features on — Pragmatic Papers")
    expect(meta.description).toBe("Experiments, per site.")
    expect(meta.alternates?.canonical).toMatch(/\/docs\/experiments$/)
  })

  it("is empty for an unknown slug", async () => {
    queries.queryDocBySlug.mockResolvedValue(null)
    await expect(generateMetadata(args("nope"))).resolves.toEqual({})
  })
})
