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
vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
}))
vi.mock("@/components/LivePreviewListener", () => ({
  LivePreviewListener: () => <div data-testid="live-preview" />,
}))

import { DocView } from "../DocView"
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
  heroImage: {
    id: 5,
    url: "/media/switches.webp",
    alt: "The experiment switches",
    mimeType: "image/webp",
    width: 1200,
    height: 630,
  },
  content: {
    root: {
      type: "root",
      version: 1,
      children: [paragraph("Some features arrive off."), heading("Where the switches are")],
    },
  },
}

const args = (slug = "experiments") => ({ params: Promise.resolve({ slug }) })
// The page hands its slug to DocView, an async component the test renders itself.
const renderPage = async (slug?: string) => {
  const page = (await DocPage(args(slug))) as React.ReactElement<{ slug: string }>
  return render((await DocView(page.props)) as React.ReactElement)
}

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

  it("renders the doc with its hero, dek, date, breadcrumbs and share buttons", async () => {
    await renderPage()
    const title = screen.getByRole("heading", { level: 1, name: "Switch beta features on" })
    const hero = screen.getByRole("img", { name: "The experiment switches" })
    // The hero sits above the title.
    expect(hero.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText("Some features arrive off.")).toBeInTheDocument()
    const date = screen.getByText("Oct. 18, 2026")
    expect(date).toHaveAttribute("datetime", "2026-10-18")
    // The summary is the dek, between the title and the date.
    const dek = screen.getByText("Experiments, per site.")
    expect(title.compareDocumentPosition(dek) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dek.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The breadcrumbs head the doc's column, not the row above the sidebar.
    const trail = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(trail.parentElement).toContainElement(title)
    expect(trail.parentElement).not.toContainElement(
      screen.getByRole("navigation", { name: "Docs" }),
    )
    expect(trail).toHaveTextContent("Docs")
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    // Signed off with the squiggle, as articles are.
    expect(document.querySelector("[class*='squiggle.svg']")).toBeInTheDocument()
    expect(screen.queryByTestId("live-preview")).not.toBeInTheDocument()
  })

  it("shows the day it was updated beside its date", async () => {
    queries.queryDocBySlug.mockResolvedValue({ ...doc, revisedAt: "2026-10-20T00:00:00.000Z" })
    await renderPage()
    expect(screen.getByText("Updated Oct. 20, 2026")).toHaveAttribute("datetime", "2026-10-20")
  })

  it("marks the doc as the current page in the docs sidebar", async () => {
    await renderPage()
    const nav = screen.getByRole("navigation", { name: "Docs" })
    expect(within(nav).getByRole("link", { name: "Switch beta features on" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(within(nav).getByRole("link", { name: "What's new" })).not.toHaveAttribute(
      "aria-current",
    )
  })

  it("always shows a table of contents linking to the doc's headings, with no toggle", async () => {
    await renderPage()
    expect(screen.getByRole("navigation", { name: "Table of contents" })).toBeVisible()
    expect(screen.queryByRole("button", { name: /contents/i })).not.toBeInTheDocument()
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

  it("ends with the previous and next docs in the sidebar's order, from Home", async () => {
    queries.queryPublishedDocs.mockResolvedValue([
      { slug: "home", title: "Docs home", navTitle: "Home", section: "getting-started" },
      { ...doc, section: "site" },
      { slug: "volumes", title: "Put together a volume", navTitle: "Volumes", section: "site" },
    ])
    await renderPage()
    const pager = screen.getByRole("navigation", { name: "Previous and next docs" })
    expect(within(pager).getByRole("link", { name: /Previous.*Home/ })).toHaveAttribute(
      "href",
      "/docs",
    )
    expect(within(pager).getByRole("link", { name: /Next.*Volumes/ })).toHaveAttribute(
      "href",
      "/docs/volumes",
    )
  })

  it("links a doc from the repo to its file on GitHub", async () => {
    queries.queryDocBySlug.mockResolvedValue({ ...doc, section: "site", sourceHash: "abc" })
    await renderPage()
    expect(screen.getByRole("link", { name: "Edit this page on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/digitalgroundgame/pragmatic-papers/edit/dev/src/docs/site/experiments.md",
    )
  })

  it("has no GitHub link for a doc written in the admin", async () => {
    await renderPage()
    expect(screen.queryByRole("link", { name: /GitHub/ })).not.toBeInTheDocument()
  })

  it("sends /docs/home to /docs, where the home doc lives", async () => {
    await expect(DocPage(args("home"))).rejects.toThrow("redirect:/docs")
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
