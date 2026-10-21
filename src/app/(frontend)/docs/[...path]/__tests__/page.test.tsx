import { cleanup, render, screen, within } from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { docParentId, docTreeParents } from "@/stories/fixtures/docsTree"

const { queries, draft, experiments } = vi.hoisted(() => ({
  queries: {
    queryDocBySlug: vi.fn(),
    queryPublishedDocs: vi.fn(),
  },
  draft: { isEnabled: false },
  experiments: {} as Record<string, boolean>,
}))

vi.mock("server-only", () => ({}))
vi.mock("@/plugins/docs/queries", () => queries)
vi.mock("next/headers", () => ({ draftMode: async () => draft }))
vi.mock("@/globals/SiteSettings/isExperimentEnabled", () => ({
  isExperimentEnabled: async (name: string) => experiments[name] ?? true,
}))
vi.mock("@/globals/Plugins/isPluginEnabled", () => ({
  isPluginEnabled: async (name: string) => experiments[name] ?? true,
}))
vi.mock("@/components/PayloadRedirects", () => ({
  PayloadRedirects: ({ url }: { url: string }) => <div data-testid="redirects" data-url={url} />,
}))
vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => {
    throw new Error(`redirect:${url}`)
  },
  redirect: (url: string) => {
    throw new Error(`moved:${url}`)
  },
  notFound: () => {
    throw new Error("notFound")
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
  id: 101,
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

const PATH = "/docs/editing/site-settings/experiments"
const args = (path = PATH) => ({
  params: Promise.resolve({ path: path.split("/").slice(2) }),
})
// The page hands its slug and path to DocView, an async component the test renders itself.
const renderPage = async (path?: string) => {
  const page = (await DocPage(args(path))) as React.ReactElement<
    React.ComponentProps<typeof DocView>
  >
  return render((await DocView(page.props)) as React.ReactElement)
}
const published = { ...doc, parent: docParentId("site-settings") }

beforeEach(() => {
  vi.clearAllMocks()
  draft.isEnabled = false
  for (const name of Object.keys(experiments)) delete experiments[name]
  queries.queryDocBySlug.mockResolvedValue(doc)
  queries.queryPublishedDocs.mockResolvedValue([...docTreeParents, published])
})
afterEach(cleanup)

describe("DocPage", () => {
  it("hands an unknown slug to the redirects", async () => {
    queries.queryDocBySlug.mockResolvedValue(null)
    await renderPage("/docs/editing/nope")
    expect(screen.getByTestId("redirects")).toHaveAttribute("data-url", "/docs/editing/nope")
  })

  it("sends a doc asked for anywhere but its place in the tree there", async () => {
    // Under no parent, and under another one, as before an editor moved it.
    await expect(renderPage("/docs/experiments")).rejects.toThrow(`moved:${PATH}`)
    await expect(renderPage("/docs/writing/experiments")).rejects.toThrow(`moved:${PATH}`)
  })

  it("leads the breadcrumbs through its area and section", async () => {
    await renderPage()
    const trail = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(within(trail).getByRole("link", { name: "Editing" })).toHaveAttribute(
      "href",
      "/docs/editing",
    )
    expect(within(trail).getByRole("link", { name: "Site settings" })).toHaveAttribute(
      "href",
      "/docs/editing/site-settings",
    )
  })

  it("lists a section's docs on its page", async () => {
    const section = docTreeParents.find((item) => item.slug === "site-settings")!
    queries.queryDocBySlug.mockResolvedValue({ ...doc, ...section, content: doc.content })
    await renderPage("/docs/editing/site-settings")
    const list = screen.getByRole("region", { name: "In this section" })
    expect(within(list).getByRole("link", { name: /Switch beta features on/ })).toHaveAttribute(
      "href",
      PATH,
    )
  })

  it("previews a draft where it was opened, with the trail its own breadcrumbs give", async () => {
    draft.isEnabled = true
    queries.queryPublishedDocs.mockResolvedValue(docTreeParents)
    queries.queryDocBySlug.mockResolvedValue({
      ...doc,
      breadcrumbs: [
        { label: "Editing", url: "/docs/editing" },
        { label: "Switch beta features on", url: "/docs/editing/experiments" },
      ],
    })
    await renderPage("/docs/experiments")
    const trail = screen.getByRole("navigation", { name: "breadcrumb" })
    expect(within(trail).getByRole("link", { name: "Editing" })).toBeInTheDocument()
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
    experiments.tableOfContents = enabled
    await renderPage()
    expect(screen.queryByRole("button", { name: /contents/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
  })

  it("ends with the previous and next docs in the sidebar's order", async () => {
    queries.queryPublishedDocs.mockResolvedValue([
      { id: 100, slug: "home", title: "Docs home", navTitle: "Home" },
      ...docTreeParents,
      { ...published, _order: "b0" },
      {
        id: 102,
        slug: "volumes",
        title: "Put together a volume",
        navTitle: "Volumes",
        parent: docParentId("site-settings"),
        _order: "b1",
      },
    ])
    await renderPage()
    const pager = screen.getByRole("navigation", { name: "Previous and next docs" })
    expect(within(pager).getByRole("link", { name: /Previous.*Site settings/ })).toHaveAttribute(
      "href",
      "/docs/editing/site-settings",
    )
    expect(within(pager).getByRole("link", { name: /Next.*Volumes/ })).toHaveAttribute(
      "href",
      "/docs/editing/site-settings/volumes",
    )
  })

  it("starts the pager at Home on the first doc", async () => {
    queries.queryPublishedDocs.mockResolvedValue([
      { id: 100, slug: "home", title: "Docs home", navTitle: "Home" },
      ...docTreeParents,
    ])
    const writing = docTreeParents[0]!
    queries.queryDocBySlug.mockResolvedValue({ ...doc, ...writing, content: doc.content })
    await renderPage("/docs/writing")
    const pager = screen.getByRole("navigation", { name: "Previous and next docs" })
    expect(within(pager).getByRole("link", { name: /Previous.*Home/ })).toHaveAttribute(
      "href",
      "/docs",
    )
  })

  it("has no GitHub link, even on a doc seeded from the repo: editors change it here", async () => {
    queries.queryDocBySlug.mockResolvedValue({
      ...published,
      sourceHash: "abc",
    })
    await renderPage()
    expect(screen.queryByRole("link", { name: /GitHub/ })).not.toBeInTheDocument()
  })

  it("sends /docs/home to /docs, where the home doc lives", async () => {
    await expect(DocPage(args("/docs/home"))).rejects.toThrow("redirect:/docs")
  })

  it("offers the doc's tour as Show me", async () => {
    queries.queryDocBySlug.mockResolvedValue({ ...doc, tour: "articles" })
    await renderPage()
    expect(screen.getByRole("link", { name: "Show me" })).toHaveAttribute(
      "href",
      "/admin?tour=articles",
    )
  })

  it.each([
    ["has no tour", doc],
    ["names a tour that doesn't exist", { ...doc, tour: "no-such-tour" }],
  ])("has no Show me when the doc %s", async (_, value) => {
    queries.queryDocBySlug.mockResolvedValue(value)
    await renderPage()
    expect(screen.queryByRole("link", { name: "Show me" })).not.toBeInTheDocument()
  })

  it("has no Show me while the tours experiment is off", async () => {
    queries.queryDocBySlug.mockResolvedValue({ ...doc, tour: "articles" })
    experiments.tours = false
    await renderPage()
    expect(screen.queryByRole("link", { name: "Show me" })).not.toBeInTheDocument()
  })

  it("is not found while the docs experiment is off", async () => {
    experiments.docs = false
    await expect(renderPage()).rejects.toThrow("notFound")
    expect(queries.queryDocBySlug).not.toHaveBeenCalled()
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
    expect(meta.alternates?.canonical).toMatch(/\/docs\/editing\/site-settings\/experiments$/)
  })

  it("is empty while the docs experiment is off", async () => {
    experiments.docs = false
    await expect(generateMetadata(args())).resolves.toEqual({})
  })

  it("is empty for an unknown slug", async () => {
    queries.queryDocBySlug.mockResolvedValue(null)
    await expect(generateMetadata(args("/docs/nope"))).resolves.toEqual({})
  })
})
